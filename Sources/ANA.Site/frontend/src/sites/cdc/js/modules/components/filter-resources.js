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
  let checkedBoxes = [];
  let xhttp = new XMLHttpRequest();
  const searchTextDesktop = document.getElementById('resource-search__desktop');
  const searchIconDesktop = document.getElementById('resource-search__desktop__icon');
  const searchTextMobile = document.getElementById('resource-search__mobile');
  const searchIconMobile = document.getElementById('resource-search__mobile__icon');
  const filterAccordion = document.getElementById('filter-accordion');
  const searchAPIDiv = document.getElementById('api-search');

  // #api-search only exists on the resource-search page. Without this guard
  // the next line threw "Cannot read properties of null (reading
  // 'getAttribute')" on every other CDC page, which aborted the rest of this
  // 170-line ready handler — including the filter-expand and form-submit
  // fixes further down. Pre-existing since the original search work; it
  // surfaced once the console was actually checked.
  if (!searchAPIDiv) {
    return;
  }

  const searchAPIValue = searchAPIDiv.getAttribute('name');
  //sends an array of checked filters to th api
  function changeFilters(searchText) {
    checkedBoxes =[];
    document.getElementById('filter-accordion').querySelectorAll('input').forEach((input) => {
      if(input.checked){
        checkedBoxes.push(input.id);
      }
    });
    let query = `&query=${searchText}`;
    let apiExt = `/web-api/${searchAPIValue}/resource-search`;
    let pageID = document.getElementById('resource-results').dataset.pageid;
    let pageQP = `?pageid=${pageID}`;
    let getUrl = window.location;
    let baseUrl = `${getUrl.protocol}//${getUrl.host}`;
    let filters = '';
    checkedBoxes.forEach((filterID) => {
      filters = `${filters}&filters=${filterID}`;
    });
    let apiCall = `${baseUrl}${apiExt}${pageQP}${query}${filters}`;
    xhttp.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
        document.getElementById('resource-results').innerHTML = this.responseText;
        //addthis.toolbox('.addthis_toolbox');
      }
    };
    xhttp.open('GET', apiCall, true);
    xhttp.send();
  }
  if (filterAccordion) {
    // Fix: querySelector only unhides the FIRST filter set (e.g. Topics),
    // leaving Type/Source hidden by default. querySelectorAll ensures every
    // top-level filter category is expanded on load.
    document.querySelectorAll('.filter-content').forEach((content) => {return content.classList.remove('hide');});
    document.querySelectorAll('.category-icon').forEach((icon) => {return icon.classList.add('flip-icon');});
    //hide or display subtopics on click
    document.querySelectorAll('.filter-label-sub').forEach((label) => {
      label.onclick = function() {
          label.parentElement?.nextElementSibling?.classList.toggle('hide');
          label.firstElementChild?.firstElementChild?.classList.toggle('flip-icon');
      };
    });
    //flip icon on click
    // Only the resource-search pages render this; without the guard every page that does not
    // threw here and lost the handlers bound below.
    const searchTitleMobile = document.querySelector('.search-title-mobile');

    if (searchTitleMobile) {
      searchTitleMobile.onclick = function() {
          document.getElementById('search-box')?.classList.toggle('hide-search-accordion');
          document.querySelector('.search-title-mobile__icon')?.classList.toggle('flip-search-icon');
      };
    }
    document.querySelectorAll('.topic-filter__category-subs').forEach((dropdown) => {
      dropdown.onclick = function() {
          document.querySelectorAll('.accordion-icon-subs').forEach((icon) => {
              icon.classList.toggle('flip-sub-icon');
          });
      };
    });
    //check all sub checkboxes if parent checkbox is checked then sends an array of checked filters to the api
    // document.querySelectorAll('.filter-checkbox-sub').forEach((subCheckbox) => {
    //   subCheckbox.onchange = function() {
    //       subCheckbox.parentElement.nextElementSibling.querySelectorAll('input').forEach((checkbox) => {
    //           if(subCheckbox.checked){
    //               checkbox.checked = true;
    //           }else{
    //               checkbox.checked = false;
    //           }
    //       });
    //       changeFilters();
    //   };
    // });
    // iterate through and get array of checked items then sends an array of checked filters to the api
    document.getElementById('filter-accordion').querySelectorAll('input').forEach((checkbox) => {
      checkbox.onclick = function() {
        if(checkbox.classList.contains('filter-checkbox-sub')){
          checkbox.parentElement.nextElementSibling.querySelectorAll('input').forEach((subCheckbox) => {
              if(checkbox.checked){
                  subCheckbox.checked = true;
              }else{
                  subCheckbox.checked = false;
              }
          });
        }
        changeFilters('');
      };
    });
    //Mobile Search Box - Enter event listener
    searchTextMobile.addEventListener('keyup', function(event) {
      // Number 13 is the "Enter" key on the keyboard
      if (event.keyCode === 13) {
        event.preventDefault();
        changeFilters(searchTextMobile.value);
      }
    });
    searchTextMobile.addEventListener('keydown', function(event) {
      // Number 13 is the "Enter" key on the keyboard
      if (event.keyCode === 13) {
        event.preventDefault();
      }
    });
    //Mobile Search Box - Icon Click event listener
    searchIconMobile.addEventListener('mousedown', function(event) {
      switch (event) {
        case 1:
          event.preventDefault();
          changeFilters(searchTextMobile.value);
          break;
        case 2:
          break;
        case 3:
          break;
        default:
          break;
      }
    });
    //Desktop Search Box - Enter event listener
    searchTextDesktop.addEventListener('keyup', function(event) {
      // Number 13 is the "Enter" key on the keyboard
      if (event.keyCode === 13) {
        event.preventDefault();
        changeFilters(searchTextDesktop.value);
      }
    });
    searchTextDesktop.addEventListener('keydown', function(event) {
      // Number 13 is the "Enter" key on the keyboard
      if (event.keyCode === 13) {
        event.preventDefault();
      }
    });
    // Fix: the desktop search input lives inside a <form> with no action/method.
    // Pressing Enter triggers the browser's native implicit form submission
    // regardless of preventDefault() on keydown/keyup, causing a full page
    // reload instead of an AJAX search. Binding directly to 'submit' reliably
    // stops that native behavior.
    const searchFormDesktop = searchTextDesktop.closest('form');
    if (searchFormDesktop) {
      searchFormDesktop.addEventListener('submit', function(event) {
        event.preventDefault();
      });
    }
    //Desktop Search Box - Icon Click event listener
    searchIconDesktop.addEventListener('mousedown', function(event) {
      switch (event.which) {
        case 1:
          event.preventDefault();
          changeFilters(searchTextDesktop.value);
          break;
        case 2:
          break;
        case 3:
          break;
        default:
          break;
      }
    });
    //hide or display filters on click
    const filterTitleMobile = document.getElementById('filter-title-mobile');

    if (filterTitleMobile) {
      filterTitleMobile.onclick = function() {
        document.getElementById('filter-accordion')?.classList.toggle('show-for-large');
        filterTitleMobile.children[0]?.classList.toggle('flip-icon');
      };
    }
    document.querySelectorAll('.filter-category').forEach((category) => {
        category.onclick = function() {
            category.firstElementChild?.firstElementChild?.classList.toggle('flip-icon');
            category.parentElement?.nextElementSibling?.classList.toggle('hide');
        };
    });
  }
});