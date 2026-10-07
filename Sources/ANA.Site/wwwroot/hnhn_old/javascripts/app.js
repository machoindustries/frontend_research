webpackJsonp([0,1],[
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	module.exports = __webpack_require__(1);


/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {

	// *********************
	//    Modules scripts
	// *********************
	
	// MINIFIED Vendor file should be copied over via copyScripts.js (it is by default)
	
	// IMPORT all modules here. Keep lib and minified files out this file.
	// Except for the example below
	// modules
	'use strict';
	
	__webpack_require__(2);
	
	__webpack_require__(3);
	
	__webpack_require__(4);
	
	__webpack_require__(5);

/***/ },
/* 2 */
/***/ function(module, exports) {

	// Function dropdown
	
	'use strict';
	
	(function () {
	    'use strict';
	
	    var dropdowns = $('.navbar-hnhn .dropdown');
	    var dropdownLink = dropdowns.children('a');
	    var search_form = $('.search-form--lg');
	    var header = $('.header');
	    var mainContent = $('.main-content');
	
	    $(window).scroll(function () {
	        var bodyTop = $(window).scrollTop();
	
	        if (bodyTop >= 10) {
	            $('.navbar-hnhn').not('.navbar--default').addClass('navbar-hnhn--scrolled');
	        } else {
	            $('.navbar-hnhn').not('.navbar--default').removeClass('navbar-hnhn--scrolled');
	        }
	    });
	
	    dropdownLink.on("click", function (event) {
	        var parent_dropdown = $(this).closest('.dropdown');
	
	        event.preventDefault();
	
	        parent_dropdown.find('.dropdown-menu').first().stop(true, true).delay(100).slideToggle(250);
	        parent_dropdown.siblings('.dropdown').find('.dropdown-menu').delay(100).slideUp(250);
	    });
	
	    $('#search_toggle').click(function (event) {
	        event.preventDefault();
	        search_form.fadeToggle('400');
	        search_form.toggleClass('opened');
	    });
	
	    $('main, footer').on('click', function (event) {
	        dropdowns.find('.dropdown-menu').delay(100).slideUp(250);
	        search_form.fadeOut('400').removeClass('opened');
	    });
	
	    // set margin top to main content
	
	    function setMargin(argument) {
	        var headerHeight = header.outerHeight();
	        mainContent.css('margin-top', headerHeight);
	    }
	
	    $(window).on('resize load', function () {
	        setMargin();
	    });
	})();

/***/ },
/* 3 */
/***/ function(module, exports) {

	'use strict';
	
	(function ($, window, document, undefined) {
	  // Create defaults
	  var pluginName = "heliumParallax",
	      defaults = {
	    paraStart: 200, // distance from the origin that parallax scroll effect will start
	    paraEnd: 200, // distance from the origin that parallax scroll effect will end
	    property: ['top'], // css property (or properties) to animate
	    minVal: ['-150px'], // minimum value for css property
	    maxVal: ['150px'], // maximum value for css property
	    valTemplate: [false], // template for complex css values. The *value* should be placed where the number should be placed.  ie "rotate(*value*deg)"
	    relate: ['linear'] // relationship to scroll movement : linear, reverse, swing, reverseSwing
	  },
	      priv = {
	    currTop: false,
	    currCenter: false,
	    currPercent: false,
	    startPoint: false,
	    endPoint: false,
	    itemTop: false,
	    itemCenter: false,
	    item: false,
	    winHeight: false,
	    newVal: false,
	    valUnit: false
	  };
	
	  function Plugin(element, options) {
	    this.element = element;
	    // use extend to merge contents of defaults, user options, and private variables
	    this.vars = $.extend({}, defaults, options, priv);
	    this._defaults = defaults;
	    this._priv = priv;
	    this._name = pluginName;
	    this.init();
	  }
	
	  Plugin.prototype = {
	    //============================================================================
	    // Init function (All initial logic goes here)
	    //============================================================================
	    init: function init() {
	      var orig = this;
	      orig.vars.valUnit = [];
	      for (var i = 0; i < this.vars.property.length; i++) {
	        orig.vars.valUnit[i] = orig.vars.minVal[i].replace(/[\d\.\-]+/g, '');
	        orig.vars.minVal[i] = parseFloat(orig.vars.minVal[i], 10);
	        orig.vars.maxVal[i] = parseFloat(orig.vars.maxVal[i], 10);
	      }
	
	      this.vars.item = $(this.element);
	      $(window).on('resize', function () {
	        orig.calc();
	      });
	      $(window).on('scroll touchmove', function () {
	        orig.parallax();
	      });
	      this.calc();
	      this.parallax();
	    },
	
	    //============================================================================
	    // Calculate key scroll points
	    //============================================================================
	    calc: function calc() {
	      var orig = this;
	
	      for (var i = 0; i < this.vars.property.length; i++) {
	        orig.vars.item.css(orig.vars.property[i], '');
	      }
	      this.vars.itemTop = $(this.vars.item).offset().top;
	      this.vars.itemCenter = this.vars.itemTop + this.vars.item.height() / 2;
	      this.vars.startPoint = this.vars.itemCenter - this.vars.paraStart;
	      this.vars.endPoint = this.vars.itemCenter + this.vars.paraEnd;
	      this.parallax();
	    },
	
	    //============================================================================
	    // parallax function. 
	    //============================================================================
	    parallax: function parallax() {
	      var orig = this;
	      this.vars.winHeight = $(window).height();
	      this.vars.currTop = $(document).scrollTop();
	      var paraPoint = this.vars.winHeight / 2;
	      if (this.vars.itemCenter < paraPoint) {
	        paraPoint = this.vars.itemCenter;
	      }
	      this.vars.currCenter = this.vars.currTop + paraPoint;
	      if (this.vars.currCenter < this.vars.startPoint) {
	        this.vars.currCenter = this.vars.startPoint;
	      }
	      if (this.vars.currCenter > this.vars.endPoint) {
	        this.vars.currCenter = this.vars.endPoint;
	      }
	      for (var i = 0; i < this.vars.property.length; i++) {
	        orig.vars.currPercent = (orig.vars.currCenter - orig.vars.startPoint) / (orig.vars.endPoint - orig.vars.startPoint);
	        if (orig.vars.relate[i] == 'reverse') {
	          orig.vars.currPercent = 1 - orig.vars.currPercent;
	        }
	        if (orig.vars.relate[i] == 'swing') {
	          orig.vars.currPercent = Math.pow(orig.vars.currPercent - 0.5, 2) / 0.5;
	          orig.vars.currPercent = Math.pow(orig.vars.currPercent - 0.5, 2) * 4;
	        }
	        if (orig.vars.relate[i] == 'reverseSwing') {
	          orig.vars.currPercent = Math.pow(orig.vars.currPercent - 0.5, 2) * 4;
	        }
	        orig.vars.newVal = orig.vars.minVal[i] + (orig.vars.maxVal[i] - orig.vars.minVal[i]) * orig.vars.currPercent;
	        if (orig.vars.valTemplate[i]) {
	          var splitTemplate = orig.vars.valTemplate[i].split('*value*');
	          $(orig.vars.item).css(orig.vars.property[i], splitTemplate[0] + orig.vars.newVal + orig.vars.valUnit[i] + splitTemplate[1]);
	        } else {
	          $(orig.vars.item).css(orig.vars.property[i], orig.vars.newVal + orig.vars.valUnit[i]);
	        }
	      }
	    }
	  };
	
	  // A lightweight plugin wrapper around the constructor
	  $.fn[pluginName] = function (options) {
	    var args = arguments;
	    if (options === undefined || typeof options === 'object') {
	      return this.each(function () {
	        if (!$.data(this, 'plugin_' + pluginName)) {
	          $.data(this, 'plugin_' + pluginName, new Plugin(this, options));
	        }
	      });
	    } else if (typeof options === 'string' && options[0] !== '_' && options !== 'init') {
	      var returns;
	      this.each(function () {
	        var instance = $.data(this, 'plugin_' + pluginName);
	        if (instance instanceof Plugin && typeof instance[options] === 'function') {
	          returns = instance[options].apply(instance, Array.prototype.slice.call(args, 1));
	        }
	        if (options === 'destroy') {
	          $.data(this, 'plugin_' + pluginName, null);
	        }
	      });
	      return returns !== undefined ? returns : this;
	    }
	  };
	})(jQuery, window, document);

/***/ },
/* 4 */
/***/ function(module, exports) {

	'use strict';
	
	$(document).ready(function () {
	    $('.helium-parallax .parallax-1').each(function (index, el) {
	        $(this).heliumParallax({
	            property: ['top'],
	            minVal: ['-40px'],
	            maxVal: ['160px'],
	            relate: ['linear']
	        });
	    });
	
	    $('.helium-parallax .parallax-2').each(function (index, el) {
	        $(this).heliumParallax({
	            property: ['top'],
	            minVal: ['-20px'],
	            maxVal: ['100px'],
	            relate: ['linear']
	        });
	    });
	});
	
	$(window).on('load resize', function (event) {
	    var windowWidth = $(this).width();
	    if (windowWidth > 767) {
	        $('.parallax-wrapper').each(function () {
	            var $this = $(this);
	            var elementHeight = $(this).find('.parallax-1').outerHeight() + 120;
	            $this.siblings('.parallax-adjacent-section').css('min-height', elementHeight);
	        });
	    } else {
	        $('.parallax-adjacent-section').css('min-height', 'auto');
	    }
	});

/***/ },
/* 5 */
/***/ function(module, exports) {

	'use strict';
	
	var wow = new WOW({
	  boxClass: 'wow', // animated element css class (default is wow)
	  animateClass: 'animated', // animation css class (default is animated)
	  offset: 0, // distance to the element when triggering the animation (default is 0)
	  mobile: false // trigger animations on mobile devices (default is true)
	});
	wow.init();

/***/ }
]);
//# sourceMappingURL=app.js.map