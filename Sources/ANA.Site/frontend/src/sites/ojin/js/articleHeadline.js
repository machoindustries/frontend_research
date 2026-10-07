const Jquery = window.$;

(function() {
	function initThisComponent() {
    var authorBio = document.querySelector('.ojin-articleHeadline');
		if (authorBio) {
			initAuthorBio();
    }

		function initAuthorBio() {
      Jquery(document).ready(function() {    

        /* author bio click */
        Jquery(".ojin-articleHeadline li a").click(function() {
          Jquery(".ojin-articleHeadline .ojin-authorBio__item").hide(); 
          Jquery(this).siblings(".ojin-authorBio__item").show(); 
          Jquery(".ojin-ttlList").removeClass("active"); 
        });	

        function documentClick() {
          Jquery('.ojin-articleHeadline li a').click(function (e) {
              e.stopPropagation();
          });
          Jquery(document).on('click', function () {
            Jquery(".ojin-articleHeadline .ojin-authorBio__item").hide(); 
          });
        }

        documentClick();

      });
    }
  }
	document.addEventListener("DOMContentLoaded", initThisComponent, false);
})();


