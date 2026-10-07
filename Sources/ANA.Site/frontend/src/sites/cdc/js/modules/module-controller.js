 

import PubSub from 'pubsub-js';

/**
 * Module maps.
 *
 * webpack resolved `require(`./core/${name}`)` by bundling the whole directory
 * as a context module. Rollup cannot do that, so the same two directories are
 * enumerated with import.meta.glob, which Vite resolves statically at build
 * time. The eager/lazy split is preserved exactly:
 *
 *   core/    eager  — bundled into cdc.js, always present
 *   dynamic/ lazy   — code-split, fetched on first use
 *
 * Keys are the literal glob paths, e.g. './core/by-the-number.js'.
 */
const coreModules = import.meta.glob('./core/*.js', { eager: true });
const dynamicModules = import.meta.glob('./dynamic/*.js');

/**
 * Controls all modules.  Instantiates modules based on data-attrubiutes specifying module
 * file-names.
 */
export default class ModuleController {

  /**
   * By default load all modules inside the document
   */
  constructor() {
    PubSub.subscribe('module', this.msgHandler.bind(this));
  }

  /**
   * Automatically instantiates modules based on data-attributes specifying module file-names.
   * Begins the search of modules at the passed in jQuery DOM node and passes through all children
   * @param {JQuery} $el - The jQuery DOM node to begin the search
   */
   
  static loadModules($el) {
    // Modules instantiated with data-module-core will be part of the main JS bundle and
    // always loaded
    $el.find('[data-module-core]').each(function MCLoadCore() {
      const $this = $(this);
      const names = $this.data('module-core').trim().split(' ');

      if (names.length > 0) {
        names.forEach((name) => {
          try {
            const dataObj = $this.data('module-ref') || {};

            // only load module once per element
            if (typeof dataObj[name] === 'undefined') {
              const loaded = coreModules[`./core/${name}.js`];

              if (!loaded) {
                throw new Error(`no core module named '${name}'`);
              }

              const Module = loaded.default;
              dataObj[name] = new Module(this);
              $this.data('module-ref', dataObj);
            }
          } catch (err) {
            console.warn(`loadModules Failure: Error loading core
             module: (${name}) ERR: ${err}`);
          }
        });
      }
    });

    // Modules instantiated with data-module-dynamic are for libaries that will be
    // loaded on demand
    $el.find('[data-module-dynamic]').each(function MCLoadDynamic() {
      const $this = $(this);
      const names = $this.data('module-dynamic').trim().split(' ');

      if (names.length > 0) {
        names.forEach((name) => {
          const load = dynamicModules[`./dynamic/${name}.js`];

          if (!load) {
            console.warn(`loadModules Failure: no dynamic module named '${name}'`);
            return;
          }

          load().then((module) => {
            const dataObj = $this.data('module-ref') || {};

            // only load module once per element
            if (typeof dataObj[name] === 'undefined') {
              const Module = module.default;
              dataObj[name] = new Module(this);
              $this.data('module-ref', dataObj);
            }
          }).catch((err) => {
            console.warn(`loadModules Failure: Error loading dynamic
             module: (${name}) ERR: ${err}`);
          });
        });
      }
    });
  }

  /**
   * Searches through all of the child elements of the passed in jQuery DOM node searching
   * for data-module attributes and automatically calls that modules' unload method then
   * deletes the reference to that loaded class
   * @param {JQuery} $el - The jQuery DOM node to begin the search
   */
  static unloadModules($el) {
    function remove() {
      let index;

      try {
        const moduleRefObj = $el.data('module-ref');

        $.each(moduleRefObj, (i, val) => {
          index = i;
          val.unload();
        });
        $el.removeData('module-ref');
      } catch (_err) {
        console.warn(`unloadModule Failure: ${index}`);
      }
    }

    // Unload Modules
    $el.find('[data-module-core], [data-module-dynamic]').each(function MCUnload() {
      const $this = $(this);
      // Can't unload a module if there is no module-ref defined
      if ($this.data('module-ref') !== undefined) {
        remove($this);
      }
    });
  }

  /**
   * Handles messages that are published to the "modules" subscription list
   * @param {string} msg - The function that the module requests to be triggered
   * @param {string|JQuery|Node|Array|Object} data - Any datatype that is passed by the
   * module for processing
   */
  msgHandler(msg, data) {
    switch (msg.substring(msg.indexOf('.') + 1)) {
      case 'load-more':
        this.loadModules(data);
        break;
      default:
    }
  }
}
