import EventEmitter from 'eventemitter3';

export default class BaseComponent extends EventEmitter {
    constructor() {
        super();

        // NOTE: this used to call setMaxListeners(0) to "turn off the memory
        // leak warning". That was never real: eventemitter3 has no listener
        // limit and never warns — the method was a no-op Node-compat stub
        // (`return this;`) in 1.x and was removed in 2.0. Calling it against
        // the current version would throw in this constructor, i.e. in every
        // component on the site.

        this.state = {};
        this.defaultOptions = {};
    }

    init($el, options) {
        this.$el = $el;
        this.options = Object.assign({}, this.defaultOptions, options);

        this.initChildren();
        this.addAriaAttributes();
        this.addListeners();
    }

    initChildren() {

    }

    addAriaAttributes() {

    }

    addListeners() {

    }
}
