/**
 * Timer class that will repeat a function with a certian interval
 */
export default class Timer {

  /**
   * this is the constructor to make a new timer
   * @param {Function} fn - the function to be repeated
   * @param {number} t - the interval of the repetition, measured in milliseconds
   */
  constructor(fn, t) {

    /**
     * the function invoked in very repeat
     * @type {Function}
     */
    this.fn = fn;

    /**
     * the interval of the repetition
     * @type {number}
     */
    this.t = t;

    /**
     * the id of the window timer which identifies the timer created by call setInterval()
     * @see https://developer.mozilla.org/en-US/docs/Web/API/WindowTimers/setInterval#Return_value
     * @type{number}
     */
    this.timerObj = null;

    /**
     * the id of the window delay which identifies the delay created by call delayStart()
     * @see https://developer.mozilla.org/en-US/docs/Web/API/WindowTimers/setTimeout#Return_value
     * @type{number}
     */
    this.delayObj = null;
  }

  /**
   * stop the timer
   */
  stop() {
    if (this.timerObj) {
      clearInterval(this.timerObj);
      this.timerObj = null;
    }
    if (this.delayObj) {
      clearTimeout(this.delayObj);
      this.delayObj = null;
    }
  }

  /**
   * start the timer, if the timer has already started, the original repetition will be stopped
   */
  start() {
    this.stop();
    this.timerObj = setInterval(this.fn, this.t);
  }

  /**
   * restart the timer, interrupt current timer and restart it,
   * if current timer is not started yet, this function will simply start it
   */
  restart() {
    this.start();
  }

  /**
   * wait a certain time then start the timer
   * @param {number} delay - the wait time
   */
  delayStart(delay) {
    this.stop();
    this.delayObj = setTimeout(this.start.bind(this), delay);
  }

  /**
   * change the function to be repeated, current timer will be stopped
   * @param {Function} newfn - the new function to be repeated
   */
  resetFuntion(newfn) {
    this.stop();
    this.fn = newfn;
  }

  /**
   * change the interval of the repetition, current timer will be stopped
   * @param {number} newt - the new interval of the repetition
   */
  resetInterval(newt) {
    this.stop();
    this.t = newt;
  }
}
