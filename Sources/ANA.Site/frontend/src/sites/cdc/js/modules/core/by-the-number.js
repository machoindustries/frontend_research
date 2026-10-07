/*eslint spaced-comment: 0 */
/*eslint class-methods-use-this: 0 */

import ScrollTrigger from '@terwanerik/scrolltrigger';
import Timer from '../utils/timer';

/**
 * This is an example of a dynamic module
 * This class is triggered by an element with the attribute: data-module-dynamic="dynamic-example"
 */
export default class ByTheNumber {

  /**
   * Sets up the widgetx
   * @param {HTMLElement} el - The widget's DOM element
   */
  constructor(el) {

    /**
     * @type {HTMLElement}
     */
    this.el = el; // Save a reference to the element with the data-module-dynamic attribute

    /**
     * @type {jQuery}
     */
    this.$el = $(el); // Convert the reference into a jQuery object

    this.onetimeels = this.el.querySelectorAll('[data-effect="OneTimeAnimation"]');
    this.setupOneTimeAnimation(this.onetimeels);

    this.countupels = this.el.querySelectorAll('[data-effect="CountUpConstantly"]');
    this.setupCountUp(this.countupels);

    this.countdownels = this.el.querySelectorAll('[data-effect="CountDownConstantly"]');
    this.setupCountDown(this.countdownels);
  }

  setupOneTimeAnimation(nodes) {
    nodes.forEach((currentValue) => {
      $(currentValue).text('');
    });

    const scrollTrigger = new ScrollTrigger();
    scrollTrigger.add(nodes, {
      once: true,
      toggle: {
        callback: {
          in: (trigger) => {
            const $element = $(trigger.element);
            $element.prop('Counter', 0).animate({
              Counter: $element.data('number'),
            }, {
              duration: 1500,
              easing: 'swing',
              step: (now) => {
                $element.text(Math.ceil(now).toLocaleString());
              },
            });
          },
        },
      },
    });
  }

  setupCountUp(nodes) {
    const scrollTrigger = new ScrollTrigger();
    scrollTrigger.add(nodes, {
      once: true,
      toggle: {
        callback: {
          in: (trigger) => {
            const $element = $(trigger.element);
            $element.timer = new Timer(() => {
              const newnumber = $element.data('number') + 1;
              $element.data('number', newnumber);
              $element.text(newnumber.toLocaleString());
            }, 1000);
            $element.timer.start();
          },
        },
      },
    });
  }

  setupCountDown(nodes) {
    const scrollTrigger = new ScrollTrigger();
    scrollTrigger.add(nodes, {
      once: true,
      toggle: {
        callback: {
          in: (trigger) => {
            const $element = $(trigger.element);
            $element.timer = new Timer(() => {
              const newnumber = $element.data('number') - 1;
              $element.data('number', newnumber);
              $element.text(newnumber.toLocaleString());
            }, 1000);
            $element.timer.start();
          },
        },
      },
    });
  }
}
