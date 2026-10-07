(function() {
	function initThisComponent() {

		function loadJS(u) {
			var r = document.getElementsByTagName("script")[0],
				s = document.createElement("script");
				s.src = u;
				r.parentNode.insertBefore(s, r);
		}    
		if (!window.HTMLPictureElement) {
		loadJS("https://afarkas.github.io/lazysizes/plugins/respimg/ls.respimg.min.js");
		}	
  }
	document.addEventListener("DOMContentLoaded", initThisComponent, false);
})();