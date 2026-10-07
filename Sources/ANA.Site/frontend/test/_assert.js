/*
 * Minimal TAP-ish assertions. No test framework is installed and none is needed: the whole suite is
 * a few hundred lines of Node, and the dependency we would add is bigger than the thing it tests.
 *
 * The API is deliberately identical to the harness on feature/log-cleanup-20291001 — same names,
 * same argument order, `name` last, doesNotThrow returning the value so assertions chain. That
 * branch and this one will both carry a frontend/test/, and keeping this file mergeable is what
 * stops the repo ending up with two ways to write a test.
 *
 * The one difference: that version reads `global.process` because it is browserified, and
 * browserify substitutes a browser `process` shim with no `exit` and no `stdout`. Nothing is
 * bundled here — test files are ESM run directly by Node — so the bare identifier is the real
 * thing.
 */

const state = { pass: 0, fail: 0, n: 0 };

function report(okay, name, extra) {
    state.n += 1;

    if (okay) {
        state.pass += 1;
        console.log('  ok ' + state.n + ' - ' + name);
    }
    else {
        state.fail += 1;
        console.log('  NOT OK ' + state.n + ' - ' + name);

        if (extra) {
            console.log('      ' + String(extra).split('\n').join('\n      '));
        }
    }

    return okay;
}

export function ok(cond, name) {
    return report(Boolean(cond), name, 'expected truthy, got: ' + JSON.stringify(cond));
}

export function equal(actual, expected, name) {
    return report(actual === expected, name,
        'expected: ' + JSON.stringify(expected) + '\nactual:   ' + JSON.stringify(actual));
}

/*
 * JSON round-trip, so it is order-sensitive and drops undefined/functions. Good enough for the
 * plain objects and arrays this suite compares, and honest about what it is: not a deep compare.
 */
export function deepEqual(actual, expected, name) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);

    return report(a === e, name, 'expected: ' + e + '\nactual:   ' + a);
}

/*
 * Returns the value so the caller can go on to assert against it.
 */
export function doesNotThrow(fn, name) {
    // Declared without an initialiser on purpose: the catch path returns null explicitly, so
    // seeding it would be an assignment nothing ever reads.
    let value;

    try {
        value = fn();
    }
    catch (e) {
        report(false, name, 'THREW: ' + e.message + '\n' + String(e.stack).split('\n').slice(1, 4).join('\n'));

        return null;
    }

    report(true, name);

    return value;
}

/*
 * Passes iff fn() throws. Pass `match` to also require the message to contain a string — several
 * of these functions throw deliberately with a message naming the fix, and a test that accepts any
 * throw would pass on an unrelated TypeError.
 */
export function throws(fn, name, match) {
    try {
        fn();
    }
    catch (e) {
        if (match && String(e.message).indexOf(match) === -1) {
            return report(false, name,
                'threw, but the message did not contain ' + JSON.stringify(match) + '\nactual: ' + e.message);
        }

        return report(true, name);
    }

    return report(false, name, 'expected a throw, nothing was thrown');
}

/*
 * Mandatory last line of every test file: nothing above throws on failure, so this is what sets the
 * exit code the runner reads.
 */
export function done() {
    console.log('  ---- ' + state.pass + ' passed, ' + state.fail + ' failed');
    process.exit(state.fail > 0 ? 1 : 0);
}
