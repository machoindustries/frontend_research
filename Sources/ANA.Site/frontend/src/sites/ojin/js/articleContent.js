const Jquery = window.$;

(function() {
	function initThisComponent() {
    var tabs = document.querySelector('.ojin-tabs');
		if (tabs) {
			initTabs();
    }

		function initTabs () {
      Jquery(document).ready(function() {

        Jquery(".ojin-tabContent").hide(); 
        Jquery("ul.ojin-tabs li:first").addClass("active").show(); 
        Jquery(".ojin-tabContent:first").show();         

        Jquery("ul.ojin-tabs li").click(function() {
          Jquery("ul.ojin-tabs li").removeClass("active"); 
          Jquery(this).addClass("active"); 
          Jquery(".ojin-tabContent").hide(); 
          var activeTab = Jquery(this).find("a").attr("href"); 
          Jquery(activeTab).fadeIn(); 
          return false;
        });	    

        /* Title Links */
        Jquery(".ojin-ttlList__anchor a").click(function() {
          Jquery(".ojin-articleHeadline .ojin-authorBio__item").hide(); 
          Jquery(".ojin-ttlList").toggleClass("active"); 
        });	 
        
        /* Heading looping through, fetching and mapping */
        var docmap = Jquery("#docmap");
	
        Jquery('#article :header').each(function(index) {
          Jquery(this).attr('id', `heading${ index}`);
          var storeId = Jquery(this).attr('id');
          docmap.append(`<li><a href='#${ storeId }'>${ this.innerHTML }</a></li>`);
        });

        /* Heading link click */
        Jquery(".ojin-ttlList__links li a").click(function() {
          Jquery(".ojin-ttlList").removeClass("active"); 
        });	 

        Jquery('.ojin-ttlList__links li a[href^="#"]').on('click', function () {
          var target = this.hash,
          $target = Jquery(target);
  
          Jquery('html, body').stop().animate({
           scrollTop: $target.offset().top-75
          }, 900, 'swing', function () {
           window.location.hash = target;
          });
        });

        /* Share icon click */
        Jquery(".ojin-options .share").click(function() {
          Jquery(".ojin-articleShare").toggle(1000); 
        });	

        /* Print option */
        Jquery(".print").click(function() {
          doiContentMovePrint();
          window.print(); 
        });	

        /* Back to top */
        Jquery(window).bind("scroll", function () {
          if (Jquery(this).scrollTop() > 600) {
            Jquery(".back-to-top").fadeIn(400);
          } else {
            Jquery('.back-to-top').fadeOut(400);
          }     
        });
        Jquery('.back-to-top').click(function() {
          Jquery('html, body').animate({ scrollTop: '0px' }, 1000);
        }); 

        /* close the flyout box when clicked on document */
        function documentClick() {
            Jquery('.ojin-ttlList__anchor a').click(function (e) {
                e.stopPropagation();
            });
            Jquery(document).on('click', function () {
                Jquery('.ojin-ttlList').removeClass('active');
            });
        }

        documentClick();


        // To insert the DOI above options icon on mobile
        function doiContentMove () {     

          if (Jquery(window).width() <= 1199) {                     
              Jquery(".ojin-articleDate").insertBefore(".ojin-ttlList");              
          } 
          else {                
              Jquery(".ojin-articleDate").prependTo(".ojin-rightRail");
          }

        }        
         
        doiContentMove();

        function doiContentMovePrint () {                                   
          Jquery(".ojin-articleDate").insertBefore(".ojin-ttlList");                        
        }   

        /* Table styling */
        Jquery(".ojin-articleContent table tbody tr:nth-child(1)").each(function() {
          if (Jquery(this).children().length > 6) {
            Jquery(this).closest('table').addClass("table table-responsive-sm table-col");
            Jquery(this).closest('table').wrapAll('<div class="ojin-figTable__table"></div>');
            Jquery(this).closest('table').removeAttr("style");
            Jquery(this).closest('table').find("tbody > tr > td").removeAttr("style");
          } else {
            Jquery(this).closest('table').addClass("table");
            Jquery(this).closest('table').wrapAll('<div class="ojin-figTable__table"></div>');
            Jquery(this).closest('table').removeAttr("style");
            Jquery(this).closest('table').find("tbody > tr > td").removeAttr("style");            
          }      
        });  

        Jquery(window).on("resize", function () {
          doiContentMove();
          documentClick();
        });
      

      });
    }
  }
	document.addEventListener("DOMContentLoaded", initThisComponent, false);
})();


