const Jquery = window.$;

(function() {
	function initThisComponent() {
    var tabs = document.querySelector('.c-search-results__categories');
		if (tabs) {
			initTabs();
    }

		function initTabs () {
      Jquery(document).ready(function() {                 
 
        /* Heading link click */
        Jquery(".c-search-results__filter-bar .filter-button").click(function() {
          Jquery("#SearchFilters").slideToggle(); 
        });	 

        Jquery(".dropdown-hover").mouseenter(function() {
          Jquery(this).addClass("is--open");
          Jquery(".overflow-options").slideDown();
        });
        Jquery(".dropdown-hover").mouseleave(function() {
          Jquery(this).removeClass("is--open");
          Jquery(".overflow-options").slideUp();
        });

      });
    }
  }
	document.addEventListener("DOMContentLoaded", initThisComponent, false);
})();
