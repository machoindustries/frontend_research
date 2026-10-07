/* global google*/
import BaseComponent from 'components/base-component';
import $ from 'jquery';
import globalEmitter from 'modules/global-emitter';

class MapComponent extends BaseComponent {
    constructor() {
        super();

        this.defaultOptions = {
            apiKey: 'AIzaSyDmfC2OzBCHX_PG0zt5yADWZjl8NfbrtUc',
            scrollwheel: false,
            scaleControl: true,
            centerLatLng: {
                lat: 39.8286,
                lng: -98.5802,
            },
            locations: [],
            markers: [],
            latLngBounds: null,
            singleLocationZoomLevel: 17,
            noLocationsZoomLevel: 4,
            pinLocation: null,
            googleFormatProperties: {
                addressComponents: 'address_components',
                state: 'administrative_area_level_1',
                country: 'country',
                types: 'types',
                shortName: 'short_name',
                longName: 'long_name',
            },
            usaCode: 'US',
        };

        this.state = {
            initialised: false,
        };

        // Tracks active dataset batch to invalidate stale asynchronous geocode callbacks
        this._activeBatchToken = 0;
    }

    initChildren() {
        this.clickedState = null;

        this._initGoogleMap();
    }

    addListeners() {

    }

    addAriaAttributes() {

    }

    updateLocations(locations) {
        this.data = locations;
        // Increment batch token so any pending geocode callbacks know they are obsolete
        this._activeBatchToken++;

        if (this.state.initialised === true) {
            this._placeMarkers();
            this._zoomToFitMarkers();
        }
    }

    _initGoogleMap() {
        $.getScript(`https://maps.googleapis.com/maps/api/js?key=${this.options.apiKey}`, this._onMapLoad.bind(this));
    }

    _onMapLoad(data, status) {
        if (status !== 'success') {
            console.log(`ERROR: Failed to get Google Maps API - status ${status}`);
            return;
        }

        this.googleMap = new google.maps.Map(this.$el[0], {
            zoom: 4,
            center: this.options.centerLatLng,
            scrollwheel: this.options.scrollwheel,
            scaleControl: this.options.scaleControl,
        });

        this._bindEventListeners();

        this._placeMarkers();
        this._zoomToFitMarkers();

        this.state.initialised = true;
    }

    _bindEventListeners() {
        if (this.options.reportClickedLocation) {
            this.geocoder = new google.maps.Geocoder();

            google.maps.event.addListener(this.googleMap, 'click', (e) => {
                const clickedLat = e.latLng.lat();
                const clickedLng = e.latLng.lng();

                this._getClickedUSAState(clickedLat, clickedLng);
            });
        }
    }

    _getClickedUSAState(lat, lng) {
        this.geocoder.geocode({ location: { lat, lng } }, (results, status) => {
            if (status === 'OK') {
                if (results[0]) {
                    const firstResult = results[0];
                    const addressComponents = firstResult[this.options.googleFormatProperties.addressComponents];

                    for (let ac = 0; ac < addressComponents.length; ac++) {
                        const addressComp = addressComponents[ac];

                        // If the component represents the country
                        if (addressComp.types.indexOf(this.options.googleFormatProperties.country) !== -1) {
                            // If the country is the USA
                            if (addressComp[this.options.googleFormatProperties.shortName] === this.options.usaCode) {
                                for (let ac2 = 0; ac2 < addressComponents.length; ac2++) {
                                    const addressComp2 = addressComponents[ac2];

                                    // If the component represents the state
                                    if (addressComp2.types.indexOf(this.options.googleFormatProperties.state) !== -1) {
                                        // Return the matching state
                                        const clickedState = addressComp2[this.options.googleFormatProperties.shortName];

                                        globalEmitter.emit('mapcomponent:stateclicked', clickedState);

                                        return;
                                    }
                                }
                            } else {
                                // If outside the USA, return the country name instead
                                const clickedCountry = addressComp[this.options.googleFormatProperties.longName];

                                globalEmitter.emit('mapcomponent:countryclicked', clickedCountry);
                            }
                        }
                    }
                } else {
                    console.log('WARNING: map-component._getClickedUSAState: No results found');
                }
            } else {
                console.log(`WARNING: map-component._getClickedUSAState: Geocoding failed. Status: ${status}`);
            }
        });
    }

    _onGetClickedUSAStateSuccess(stateCode) {
        this.clickedState = stateCode;
    }

    _placeMarkers() {
        this._deleteAllMarkers();

        if (!this.data || !Array.isArray(this.data)) {
            return;
        }

        if (!this.geocoder && typeof google !== 'undefined') {
            this.geocoder = new google.maps.Geocoder();
        }

        // Snapshot current batch token to verify async geocode callbacks belong to the active state selection
        const batchToken = this._activeBatchToken;

        const createMarker = (latLng, locationData) => {
            // Guard: If another state selection occurred while geocoding was pending, abort rendering this marker
            if (this._activeBatchToken !== batchToken) {
                return;
            }

            // Guard against Null Island (0,0) coordinates
            if (!latLng || latLng.lat() === 0 && latLng.lng() === 0) {
                console.warn(`Skipping marker at (0,0) for: ${locationData.FacilityName1}`);
                return;
            }

            const marker = new google.maps.Marker({
                position: latLng,
                map: this.googleMap,
            });

            let title = locationData.StateName || locationData.FacilityName1 || '';

            let url = '';
            if (locationData.WebAddress && !locationData.WebAddress.match(/^[a-zA-Z]+:\/\//)) {
                url = `http://${locationData.WebAddress}`;
            } else if (locationData.WebAddress) {
                url = locationData.WebAddress;
            }

            let addressParts = [
                locationData.address1,
                locationData.address2,
                locationData.city,
                locationData.state,
                locationData.postalCode
            ].filter(Boolean);

            let address = addressParts.join(', ');

            const contentString = `<h3 class="c-cta-block__heading">${title}</h3>
                <div>${address}</div>
                <div><a href="${url}" target="_blank" title="${title}">${locationData.WebAddress || ''}</a></div>`;

            const infowindow = new google.maps.InfoWindow({
                content: contentString
            });

            google.maps.event.addListener(marker, 'click', () => {
                infowindow.open(this.googleMap, marker);
                globalEmitter.emit('mapcomponent:locationselected', locationData);
            });

            this.options.markers.push(marker);

            // Safely extend bounds and re-center map as geocoded markers arrive asynchronously
            if (!this.options.latLngBounds) {
                this.options.latLngBounds = new google.maps.LatLngBounds();
            }
            this.options.latLngBounds.extend(latLng);
            this.googleMap.fitBounds(this.options.latLngBounds);
        };

        // Delay counter used to throttle client-side geocoding requests
        let geocodeDelay = 0;

        for (let loc = 0; loc < this.data.length; loc++) {
            const location = this.data[loc];

            if (location) {
                let lat = parseFloat(location.Latitude);
                let lng = parseFloat(location.Longitude);

                // Use direct coordinates if valid non-zero numbers exist
                if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) > 0.001 && Math.abs(lng) > 0.001) {
                    const myLatlng = new google.maps.LatLng(lat, lng);
                    createMarker(myLatlng, location);
                } else {
                    // Fallback to address geocoding when latitude/longitude are missing or invalid
                    let fullAddress = [
                        location.address1,
                        location.city,
                        location.state,
                        location.postalCode
                    ].filter(Boolean).join(', ');

                    if (fullAddress && this.geocoder) {
                        // setTimeout throttles geocoding requests in 200ms increments to prevent Google API OVER_QUERY_LIMIT errors
                        setTimeout(() => {
                            // Check before triggering geocoder to avoid unnecessary API calls if user switched state
                            if (this._activeBatchToken !== batchToken) {
                                return;
                            }

                            this.geocoder.geocode({ address: fullAddress }, (results, status) => {
                                // Check after geocoder responds to prevent rendering stale markers from a previous state filter
                                if (this._activeBatchToken !== batchToken) {
                                    return;
                                }

                                if (status === 'OK' && results && results[0]) {
                                    createMarker(results[0].geometry.location, location);
                                } else {
                                    console.error(`Geocoding failed for "${location.FacilityName1}" (${fullAddress}): ${status}`);
                                }
                            });
                        }, geocodeDelay);

                        // Increment throttle delay by 200ms for each consecutive fallback request
                        geocodeDelay += 200;
                    }
                }
            }
        }

        if (this.data && this.data.length > 0) {
            globalEmitter.emit('mapcomponent:locationselected', this.data[0]);
        }
    }

    _deleteAllMarkers() {
        if (this.options.markers && this.options.markers.length > 0) {
            for (let m = 0; m < this.options.markers.length; m++) {
                if (this.options.markers[m]) {
                    this.options.markers[m].setMap(null);
                }
            }
            this.options.markers = [];
        }
    }

    _zoomToFitMarkers() {
        if (!this.data || !Array.isArray(this.data)) {
            return;
        }

        const filterData = this.data.filter(Boolean);

        if (filterData.length === 0) {
            this.googleMap.setCenter(this.options.centerLatLng);
            this.googleMap.setZoom(this.options.noLocationsZoomLevel);
            return;
        }

        this.options.latLngBounds = new google.maps.LatLngBounds();

        for (let i = 0; i < this.data.length; i++) {
            const loc = this.data[i];

            if (loc) {
                let lat = parseFloat(loc.Latitude);
                let lng = parseFloat(loc.Longitude);

                if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) > 0.001 && Math.abs(lng) > 0.001) {
                    const myLatlng = new google.maps.LatLng(lat, lng);
                    this.options.latLngBounds.extend(myLatlng);
                }
            }
        }

        if (!this.options.latLngBounds.isEmpty()) {
            this.googleMap.setCenter(this.options.latLngBounds.getCenter());

            // For single results, use the single result default zoom level
            if (filterData.length === 1) {
                this.googleMap.setZoom(this.options.singleLocationZoomLevel);
            } else {
                this.googleMap.fitBounds(this.options.latLngBounds);
            }
        }
    }
}

export default () => {
    return new MapComponent();
};