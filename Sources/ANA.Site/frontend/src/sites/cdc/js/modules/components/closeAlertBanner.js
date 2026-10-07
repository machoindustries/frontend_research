/*eslint indent: 0 */
/*eslint no-undef: 0 */
/*eslint spaced-comment: 0 */

function closeAlertBanner() {

    /**
     * Closes the alert banner when the user clicks on the
     * "x" icon. Also adds a session item to the user's
     * browser after the user closes the alert banner,
     * which keeps the alert banner closed until the user
     * closes the browser tab.
     */
     const alertBanner = document.getElementById('alertBanner');
     const alertBannerX = document.getElementById('alertBannerX');
    if (alertBanner) {
        alertBannerX.addEventListener('click', () => {
            alertBanner.classList.add('hide');
            //alertBanner.classList.add('no-display')
            // Create session item to track alert banner close
            sessionStorage.setItem('close-alert-banner', true);
        });
    }
    // If the user has the 'close-alert-banner' session item,
    // keep the alert banner closed.
    if (sessionStorage.getItem('close-alert-banner')) {
        alertBanner.classList.add('hide');
    }
}

closeAlertBanner();
