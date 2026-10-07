/*eslint spaced-comment: 0 */
/*eslint no-new: 0 */
/*eslint func-names: 0 */
/*eslint prefer-arrow-callback: 0 */

import { Reveal } from 'foundation-sites';

/**
 * This is an example module that is bundled into main app.js file
 */
export default class ResourceModal {

  /**
   * Sets up the example widget
   * @param {HTMLElement} el - The widget's DOM element
   */
  constructor(el) {
    // NOTE: this used to assign to a bare `module` (module.$el, module.$modal,
    // ...). Under webpack that resolved to the injected CommonJS module object,
    // so it happened to work as a module-scoped store. There is no `module` in
    // an ES module, so it would throw ReferenceError once built by Vite.
    //
    // Rewritten to instance state. Behaviour is unchanged here because exactly
    // one element carries data-module-core="resource-modal" (it is declared in
    // _CDC.cshtml itself), so there was only ever one instance sharing it.
    const self = this;

    this.$el = $(el);
    this.$modal = $('.resource-modal');
    if (!this.$modal.length) {
      const template = `
      <div class="resource-modal reveal" id="resource-modal" data-reveal>
      <div class="resource-modal-content">
      </div>
      <button class="close-button" data-close aria-label="Close modal" type="button">
          <span aria-hidden="true">&times;</span>
        </button>
      </div>
      `;
      this.$modal = $(template);
      this.$modal.appendTo('body');
      new Reveal(this.$modal);
    }
    this.$modalContent = this.$modal.find('.resource-modal-content');

    // `self` rather than `this` inside these callbacks: jQuery binds `this` to
    // the DOM element, and the click handler relies on that via $(this).
    this.$el.on('click', "*[data-open='resource-modal']", function () {
      /* eslint-disable-next-line no-invalid-this -- jQuery binds `this` to the clicked element */
      self.$modalContent.html(decodeURIComponent($(this).data('embeded-content')));
    });

    $('#resource-modal').on('closed.zf.reveal', function () {
      self.$modalContent.html('');
    });
  }

  /**
   * Unload the widget
   */
  unload() {
    this.el.innerHTML = 'Core Example Module unloaded';
  }
}
