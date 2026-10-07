/*eslint object-curly-spacing: 0 */
/*eslint indent: 0 */
/*eslint no-undef: 0 */
/*eslint prefer-arrow-callback: 0 */
/*eslint space-before-function-paren: 0 */
/*eslint brace-style: 0 */
/*eslint no-multiple-empty-lines: 0 */
/*eslint spaced-comment: 0 */
/*eslint func-names: 0 */
/*eslint padded-blocks: 0 */
/*eslint no-useless-escape: 0 */
/*eslint comma-spacing: 0 */
/*eslint no-const-assign: 0 */
/*eslint keyword-spacing: 0 */
/*eslint space-infix-ops: 0 */
/*eslint eqeqeq: 0 */
/*eslint no-extra-semi: 0 */
/*eslint space-before-blocks: 0 */
/*eslint space-in-parens: 0 */


$(document).ready(function () {
  // display on mobile when button clicked
  $('.disclaimer__button').click(function () {
    /* eslint-disable-next-line no-invalid-this -- jQuery binds `this` to the clicked element */
    const $button = $(this);
    const $disclaimer = $button.parent().find('.disclaimer__text');
    if ($disclaimer.is(':visible')) {
      // On click hide if displayed
      $disclaimer.removeClass('show');
      $button.text('View Disclaimer');
    }
    else {
      // On click show if hidden
      $disclaimer.addClass('show');
      $button.text('Hide Disclaimer');
    }
  });
  const disclaimerBtn = document.getElementById('disclaimer-btn');
  let disclaimerIsOpen = false;

  // Only the pages carrying a disclaimer render this button.
  if (!disclaimerBtn) { return; }

  disclaimerBtn.onclick = function() {
      disclaimerIsOpen = !disclaimerIsOpen;
      document.getElementById('disclaimer-small-content')?.classList.toggle('hide');
      document.getElementById('disclaimer-big-content')?.classList.toggle('hide');
      if(disclaimerIsOpen) {
          disclaimerBtn.innerText = 'Show Less';
      }else {
          disclaimerBtn.innerText = 'Read More';
       }
  };
});




