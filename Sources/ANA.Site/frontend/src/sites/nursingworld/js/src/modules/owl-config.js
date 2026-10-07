import $ from 'jquery';
import 'owl.carousel';

/**
 * Shared owl.carousel setup. Import this instead of 'owl.carousel' directly.
 *
 * owl 2.3.4 added a `checkVisibility` option, defaulting to true, which makes
 * a carousel skip work when it is not currently visible. 2.2.0 had no such
 * check at all (zero occurrences in its source), so carousels that are hidden
 * at init — inside tabs, accordions, or anything toggled after load — would
 * change behaviour on upgrade.
 *
 * Several carousels here are rendered inside collapsed or tabbed containers
 * (HeroArea.cshtml wraps the hero carousel in a [data-tabs] element), so the
 * default is pinned back to the 2.2.0 behaviour rather than letting the
 * upgrade change initialisation semantics.
 *
 * Revisit alongside backlog item 18: leaving it true is upstream's intent and
 * avoids wasted layout work, but needs a deliberate browser pass across every
 * carousel that can start hidden.
 */
if ($.fn.owlCarousel && $.fn.owlCarousel.Constructor) {

    $.fn.owlCarousel.Constructor.Defaults.checkVisibility = false;
}
