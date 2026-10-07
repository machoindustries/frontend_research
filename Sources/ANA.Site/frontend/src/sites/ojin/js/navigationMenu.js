const Jquery = window.$;

(function() {
	function initThisComponent() {
    var header = document.querySelector('.ojin-nav__bar');
		if (header) {
			initHeaderNav();
    }

		function initHeaderNav () {
      Jquery(document).ready(function() {

        menuClick();

        // Hamburger click event
        function menuClick() {
          if (Jquery(window).width() <= 1160) {
            Jquery('.ojin-header__hamburger a').click(function() {                    
              Jquery('.ojin-nav__wrapper').toggleClass('active');                    
              Jquery('body').toggleClass('overflowHidden'); 
            });  
          } else {
            Jquery('.ojin-nav__wrapper').removeClass('active');  
            Jquery('body').removeClass('overflowHidden'); 
          }
        }
        
        // Hamburger - Close - click event
        Jquery('.ojin-nav__menuClose a').click(function() {                    
          Jquery('.ojin-nav__wrapper').removeClass('active');                    
          Jquery('body').removeClass('overflowHidden');
         // Jquery('.bf-header-wrap').css('z-index', 'inherit');          
        });
        
        Jquery(window).resize(function() {
          menuClick();
        });


        // below scripts are for stopping the nav item from redirecting on first click on mobile


        // checking if nav item has children
        if (Jquery(window).width() <= 1160) {
          Jquery('.ojin-nav > ul > li:has(> ul)').addClass("menu-item-has-children");
        }
                
        Jquery('.ojin-nav ul li').click(function() {
          Jquery(this).siblings().removeClass('clicked');
        });

        Jquery(document).on('click', '.menu-item-has-children:not(.clicked)', function(e) {
          e.preventDefault();          
          Jquery(this).addClass("clicked");
        });
        
        /* Optional If you'll redirect the user to a new tab/window and still need the element to hide the dropdown menu  add another click event*/
        Jquery(document).on('click', '.menu-item-has-children.clicked', function() {
          Jquery(this).removeClass("clicked");
        });

        // scripts to stop nav on first click ends here 

        // alert script 
        if (sessionStorage.getItem('ojinAlertShown') === null) {
          Jquery('.alert-box__container').addClass('show');
          Jquery('.alert-box .close').click(function() {
            sessionStorage.setItem('ojinAlertShown', 'true');
            Jquery(".alert-box__container").removeClass("show");  
          });
        } else {
          Jquery(".alert-box__container").removeClass("show");  
        }
        
        


      });

      // Nav sticky on scroll
      Jquery(window).on('load', function() {         
        var navpos = Jquery('.ojin-nav__bar').offset();              
        Jquery(window).bind('scroll', function () {
            if (Jquery(window).scrollTop() > navpos.top) {
                Jquery('.ojin-nav__bar').css('position', 'fixed');                  
            } else {
                Jquery('.ojin-nav__bar').css('position', 'absolute');   
            }
        });        
      });

      // search box expand script
      Jquery("body").on("keyup", ".ojin-search-desk input:text, .ojin-search-mobile input:text", function () {
        if (Jquery(this).val().length >= 1) {
          Jquery(this).addClass('active');
        } else {
          Jquery(this).removeClass('active');
        }
      });


      
    }
  }
	document.addEventListener("DOMContentLoaded", initThisComponent, false);
})();


