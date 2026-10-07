// search bar / mobile nav
const mainArea = document.querySelector('main');
const searchBtn = document.querySelector('.main-header__search-btn');
const searchBar = document.querySelector('.main-header__search-bar');
const mainNav = document.querySelector('.main-header__nav');
const navItem = document.querySelectorAll('.main-header__nav .nav-item');
const mobileBtn = document.querySelector('.main-header__mobile-btn');
const mobileNav = document.querySelector('.main-header-wrap');

// Both take elements queried at module load. Not every page renders every one of them, and
// without this an absent element threw and took the rest of this file with it.
function toggle(clickedEl, activeEl) {
    if (!clickedEl || !activeEl) { return; }

    clickedEl.addEventListener('click', function() {
        clickedEl.classList.toggle('active');
        activeEl.classList.toggle('active');
    });
}
function hide(clickedEl, activeEl) {
    if (!clickedEl || !activeEl) { return; }

    clickedEl.addEventListener('click', function() {
        activeEl.classList.remove('active');
    });
}

toggle(mobileBtn, mobileNav);
toggle(searchBtn, searchBar);
hide(mainNav, searchBar);
hide(mainNav, searchBtn);
hide(mainArea, searchBar);
hide(mainArea, searchBtn);

// 'accessibly' show that menus are open
window.addEventListener('resize', function() {
    navItem.forEach((navItem) => {
        if (window.innerWidth < 1200) {
            navItem.setAttribute('aria-expanded', 'true');
        }
        else {
            navItem.setAttribute('aria-expanded', 'false');
        }
    });
});

// accessible new tab/window links
const link = document.querySelectorAll('a');

link.forEach((link) => {
    if (link.hasAttribute('target', '_blank')) {
        link.setAttribute('aria-label', 'Link opens in a new tab');
    }
});

// carousels
const carousel = document.querySelector('.swiper');
const heroCarousel = document.querySelectorAll('.carousel');
const swiperPrev = document.querySelectorAll('.swiper-button-prev');
const swiperNext = document.querySelectorAll('.swiper-button-next');

if (carousel) {
    const swiper = new Swiper('.swiper', {
        autoplay: {
            delay: 7000,
        },
        pagination: {
            el: '.swiper-pagination',
        },
        navigation: {
            nextEl: '.swiper-button-next',
            prevEl: '.swiper-button-prev',
        }
    });
}

// IG Carousel
document.addEventListener('DOMContentLoaded', function () {
    if (document.querySelector('.instagram-carousel')) {
        const swiper = new Swiper('.instagram-carousel', {
            navigation: {
                nextEl: '.swiper-button-next',
                prevEl: '.swiper-button-prev',
            },
            slidesPerView: 4,
            spaceBetween: 22,
            breakpoints: {
                320: {
                    slidesPerView: 1,
                    spaceBetween: 12
                },
                570: {
                    slidesPerView: 2,
                    spaceBetween: 16
                },
                1200: {
                    slidesPerView: 4,
                    spaceBetween: 22
                }
            },
            autoplay: {
                delay: 7000,
                disableOnInteraction: false,
            },
        });
    }
});

// hero carousel
if (heroCarousel) {
    document.addEventListener('DOMContentLoaded', function () {
        let carousel = document.querySelectorAll('.carousel');

        for (let i = 0; i < carousel.length; i++) {
            let carouselId = carousel[i].setAttribute('id', `heroCarousel-${i}`);
            const indicatorsContainer = carousel[i].querySelector('.carousel-indicators');
            const prev = carousel[i].querySelector('.carousel-control-prev');

            if (prev) { prev.dataset.bsTarget = `#heroCarousel-${i}`; }

            const next = carousel[i].querySelector('.carousel-control-next');

            if (next) { next.dataset.bsTarget = `#heroCarousel-${i}`; }
            const items = carousel[i].querySelectorAll('.carousel-inner .carousel-item');
            items.forEach((item, index) => {
                const indicator = document.createElement('button');
                indicator.type = 'button';
                indicator.dataset.bsTarget = `#heroCarousel-${i}`;
                indicator.dataset.bsSlideTo = index;
                indicator.setAttribute('aria-label', `Slide ${index + 1}`);
                if (index === 0) {
                    item.classList.add('active');
                    indicator.classList.add('active');
                    indicator.setAttribute('aria-current', 'true');
                }
                if (indicatorsContainer) { indicatorsContainer.appendChild(indicator); }
            });
        }
    });
}

// carousel accessibility fix
const carouselNav = document.querySelectorAll('.swiper-button-prev, .swiper-button-next');

if (carouselNav) {
    carouselNav.forEach((navItem) => {
        navItem.setAttribute('aria-hidden', 'false');
    });
}

// animation
AOS.init({
    duration: 600,
    easing: 'ease-in-sine',
    delay: 100,
    disable: 'mobile',
});

// video block modal pause
const videoModal = document.querySelectorAll('.modal--video');
const iframe = document.querySelectorAll('iframe');
videoModal.forEach(function(modal) {
    modal.addEventListener('click', function() {
        let videoSrc = modal.querySelector('.video-block__iframe').src;
        let video = modal.querySelector('.video-block__iframe');
        video.setAttribute('src', `${videoSrc}`);
    });
});

// bio block flip
const bioBlock = document.querySelectorAll('.bio-collection__block');


bioBlock.forEach(function (block) {
    const bioBlockLink = block.querySelectorAll('.bio-collection__link');
    bioBlockLink.forEach(function (link) {
        link.addEventListener('click', function () {
            block.classList.toggle('active');
        });
    });
});

// responsive youtube/vimeo
if (iframe.length > 0) {
    iframe.forEach((iframe) => {
        let parent = document.createElement('div');
        parent.classList.add('ratio', 'ratio-16x9');
        if (iframe.src.includes('youtube') || iframe.src.includes('vimeo')) {
            if (!iframe.closest('.ratio')) {
                iframe.parentNode.insertBefore(parent, iframe);
                parent.appendChild(iframe);
            }
        }
    });
}

/* notification cookie bar */
// Create
function createNotificationCookie(name, value, days) {
    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
        var expires = `; expires=${ date.toGMTString()}`;
    } else {var expires = "";}
    document.cookie = `${escape(name) }=${ escape(value) }${expires }; path=/`;
}
// Read
function readNotificationCookie(name) {
    var nameEQ = `${escape(name) }=`;
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {c = c.substring(1, c.length);}
        if (c.indexOf(nameEQ) == 0) {return unescape(c.substring(nameEQ.length, c.length));}
    }
    return null;
}
// Erase
function eraseNotificationCookie(name) {
    createNotificationCookie(name, "", -1);
}
document.querySelectorAll(".c-notification-bar").forEach(
    function (elem) {
        var id = elem.id;
        //Check to see if the Notification cookie has been set, if not switch on the consent bar
        if (!readNotificationCookie(`NotificationCookieAlertModel${ id}`)) {
            elem.classList.add("show");
        }
    });

const cookieAccept = document.querySelector(".accept");
const cookieDecline = document.querySelector(".decline");

document.querySelectorAll(".c-notification-bar .btn").forEach(function (elem) {
    elem.addEventListener("click", function () {
        var parentNotificationBar = elem.closest(".c-notification-bar");
        var id = parentNotificationBar.id;
        if (elem === cookieAccept) {
            createNotificationCookie(`NotificationCookieAlertModel${ id}`, 'true', 1000);
            parentNotificationBar.classList.remove("show");
        }
        else if (elem === cookieDecline) {
            createNotificationCookie(`NotificationCookieAlertModel${ id}`, 'false', 1000);
            parentNotificationBar.classList.remove("show");
        }
    });

});

// footer copyright date
const copyrightDate = document.querySelector('.copy-date');

let currentYear = new Date().getFullYear();
if (copyrightDate) {
    copyrightDate.textContent = `${currentYear } `;
}