!(function(){ // Protect global scope with an IIFE
  'use strict';

  // Constants
  var KEY_ENTER = 13;
  var PIXEL_RATIO = window.devicePixelRatio || 1;
  var RESULT_IMG_SIZE = PIXEL_RATIO * 30;
  var DETAIL_IMG_SIZE = (PIXEL_RATIO * 136) + 'x' + (PIXEL_RATIO * 102);
  var AUTH_URL = location.href.replace(/(#.*)$/, ''); // Remove hash component
  var GM_KEY = 'AIzaSyAtc5WZa-5SRUzA39uYry0v7_5gjuaJYGo';
  var FOURSQUARE_ID = '1PHYBXTFX5HKPH04NSSALNVZFLPOZF1UTHU32ANZKRQLNEJH';
  var FOURSQUARE_CONNECT_URL = '//foursquare.com/oauth2/authenticate?' +
    'response_type=token' +
    '&client_id=' + FOURSQUARE_ID +
    '&redirect_uri=' + encodeURIComponent(AUTH_URL);

  // Top level objects
  var scope = {
    foursquareAccessToken: null,
    map: null,
    geocoder: null,
    locationMarker: null,
    markers: [],
    radius: null,
    latLng: null,
    address: null,
  };
  var elements = { // DOM reference cache
    map: document.getElementsByClassName('map')[0],
    login: document.getElementsByClassName('login')[0],
    loginBtn: document.getElementById('loginBtn'),
    content: document.getElementsByClassName('content')[0], 
    search: document.getElementsByClassName('search')[0],
    searchInput: document.getElementById('searchInput'),
    searchLocate: document.getElementsByClassName('search__locate')[0],
    results: document.getElementsByClassName('results')[0],
    resultsClearBtn: document.getElementById('resultsClearBtn'),
    resultsRadiusBtn: document.getElementById('resultsRadiusBtn'),
    resultsLocation: document.getElementsByClassName('results__location')[0],
    resultsContainer: document.getElementsByClassName('results__container')[0],
    detail: document.getElementsByClassName('detail')[0],
    detailTitle: document.getElementsByClassName('detail__title')[0],
    detailCategory: document.getElementsByClassName('detail__category')[0],
    detailRating: document.getElementsByClassName('detail__rating')[0],
    detailPrice: document.getElementsByClassName('detail__price')[0],
    detailAddress: document.getElementsByClassName('detail__address')[0],
    detailPhotos: document.getElementsByClassName('detail__photos')[0],
  };

  // Try to restore data from local storage
  try {
    scope.foursquareAccessToken = localStorage.getItem('foursquareAccessToken')
  } catch(ignore) {
    // localStorage thows error on private tabs.
    scope.foursquareAccessToken = null;
  }

  // --------------------------------------------------------------------------
  // Helpers ------------------------------------------------------------------

  /**
   * Fetch API helper to handle JSON responses
   * @param {string} url - Target URL
   * @return {Promise}
   */
  var fetchJson = window.fetchJson || function fetchJson(url) {
    return fetch(url, { mode: 'cors' }).then(function (response) {
      if (!response.ok) {
        return Promise.reject(response);
      }

      if (response.headers.get('Content-Type').indexOf('application/json') >= 0) {
        return response.json();
      }

      return Promise.resolve();
    });
  }

  function onRequestError(error) {
    if (error.status === 401) {
      // Logout
      setFoursquareAccessToken(null);
      location.hash = '';
    } else {
      console.log('Error:', error);
    }
  }

  /**
   * Reads URL hash parameters
   */
  function processUrl() {
    var urlParams = {};
    
    location.hash.substr(1).split('&').forEach(function (param) {
      var paramsArray = param.split('=');
      var key = paramsArray.length >= 1 ? paramsArray[0] : null;
      
      if (!key)
        return;

      urlParams[key] = paramsArray.length === 2 ? paramsArray[1] : true;
    })

    // Process Foursquare OAuth token
    if (urlParams.access_token) {
      setFoursquareAccessToken(urlParams.access_token);

      // Hide access_token from URL
      // NOTE: This will trigger another hashchange event
      location.hash = '';
      return;
    }

    if (!scope.foursquareAccessToken) {
      showView('login');
      return;
    }

    if (urlParams.detail) {
      clearResults();
      clearDetails();
      fetchDetail(urlParams.detail);
      showView('detail');
      return;
    }

    if (urlParams.search) {
      clearResults();
      if (urlParams.search === true) {
        getCurrentPosition();
      } else {
        searchLocation({ address: urlParams.search });
      }
      showView('results');
      return;
    }

    clearResults();
    showView('search');
  }
  window.addEventListener('hashchange', processUrl);

  /**
   * Stores Foursquare Access Token
   * @param {?string} accessToken - Access token
   */
  function setFoursquareAccessToken(accessToken) {
    // Store in root scope
    scope.foursquareAccessToken = accessToken;

    // Store in localstorage
    try {
      if (accessToken === null) {
        localStorage.removeItem('foursquareAccessToken');
      } else {
        localStorage.setItem('foursquareAccessToken', accessToken)
      }
    } catch(ignore) {
      // localStorage thows error on private tabs. Just ignore it.
    }
  }

  /**
   * Switches current active view
   * @param {('login'|'search'|'results'|'detail')} view - View name
   */
  function showView(view) {
    switch(view) {
      case 'login':
        elements.content.style.top = '100%';
        break;
      case 'search':
        elements.content.style.top = 'calc(100% - 166px)';
        break;
      case 'results':
      case 'detail':
        elements.content.style.top = '42%';
        break;
      default:
        console.error('Invalid view name:', view);
        elements.content.style.top = 'unset';
    }

    elements.login.classList  [view === 'login'   ? 'remove' : 'add']('hidden');
    elements.search.classList [view === 'search'  ? 'remove' : 'add']('hidden');
    elements.results.classList[view === 'results' ? 'remove' : 'add']('hidden');
    elements.detail.classList [view === 'detail'  ? 'remove' : 'add']('hidden');
  }

  // ---------------------------------------------------------------------------
  // Map -----------------------------------------------------------------------

  /**
   * Google Maps API init function.
   * Must be available in global scope.
   */
  window.initMap = function () {
    scope.map = new google.maps.Map(elements.map, {
      center: { lat: 52.369713, lng: 4.894867 }, // Amsterdam center
      zoom: 14,
      zoomControl: false,
      mapTypeControl: true,
      scaleControl: false,
      streetViewControl: false,
      rotateControl: false,
      fullscreenControl: false,
      styles: [{
        featureType: 'all',
        elementType: 'labels',
        stylers: [{ visibility: 'off' }],
      }],
    });

    scope.geocoder = new google.maps.Geocoder();

    scope.locationMarker = new google.maps.Marker({
      map: scope.map,
      icon: {
        path: 'M -8, 0 a 8,8 0 1,0 16,0 a 8,8 0 1,0 -16,0',
        fillColor: '#4185f4',
        fillOpacity: 1,
        scale: 1,
        strokeColor: '#fff',
        strokeWeight: 3,
      },
    });

    if (!navigator.geolocation) {
      elements.searchLocate.classList.add('hidden');
    }

    processUrl();
  };

  function adjustRadius() {
    var question = 'Search distance (in meters) or leave empty for automatic:';
    var valueStr = prompt(question, scope.radius || '');
    var value = valueStr.length === 0 ? null : parseInt(valueStr);

    // Check if it's NaN
    while (value !== value) {
      valueStr = prompt('Invalid value.\n' + question, valueStr);
      value = valueStr.length === 0 ? null : parseInt(valueStr);
    }

    var changed = scope.radius !== value;
    scope.radius = value;

    if (changed && scope.latLng) {
      // Update search with updated radius
      clearResults();
      searchVenues(scope.latLng);
    }
  }

  /**
   * Use Geolocation API to aquire current position
   */
  function getCurrentPosition() {
    if (!navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(function(position) {
      var latLng = new google.maps.LatLng(
        position.coords.latitude, 
        position.coords.longitude
      );
      searchLocation({ location: latLng });
    });
  }

  // ---------------------------------------------------------------------------
  // Search --------------------------------------------------------------------

  /**
   * Find GPS coordinates to given address and set user position there
   * @param {object} options - Google Maps geocode service object
   * @param {string} [options.address] - The address which you want to geocode
   * @param {LatLng} [options.location] - The location for which you wish to
   * obtain the closest, human-readable address
   */
  function searchLocation(options) {
    scope.geocoder.geocode(options, function(results, status) {
      if (status !== 'OK') {
        setResultsEmpty(status);
        return;
      }
      scope.latLng = results[0].geometry.location;
      scope.address = results[0].formatted_address;

      // Update UI
      elements.resultsLocation.innerText = scope.address;

      // Update map
      scope.locationMarker.setPosition(scope.latLng);
      centerMap();

      // Update search
      searchVenues(scope.latLng);
    });
  }

  /**
   * Search for venues around targeted position
   * @param {LatLng} latLng - Google maps LatLng object
   */ 
  function searchVenues(latLng) {
    if (!scope.foursquareAccessToken) {
      return Promise.reject();
    }

    var url = '//api.foursquare.com/v2/venues/explore' +
      '?oauth_token=' + scope.foursquareAccessToken +
      '&v=20171001' +
      '&sortByDistance=1' +
      // '&limit=20' +
      '&ll=' + latLng.toUrlValue() +
      (scope.radius ? ('&radius=' + scope.radius) : '');

    fetchJson(url)
      .then(onSearchResponse, onRequestError);
  }

  // ---------------------------------------------------------------------------
  // Results -------------------------------------------------------------------
  function clearResults() {
    // Clear markers
    scope.markers.forEach(function (marker) {
      marker.setMap(null);
    });
    scope.markers = [];

    // Clear results
    while (elements.resultsContainer.firstChild) {
      elements.resultsContainer.removeChild(elements.resultsContainer.firstChild);
    }
  }

  function onSearchResponse(data) {
    var venueList = data.response.groups[0].items;

    venueList.forEach(function(result) {
      createResultMarker(result.venue);
      var resultItem = createResultItem(result.venue);
      elements.resultsContainer.appendChild(resultItem);
    });

    centerMap();
  }

  function createResultMarker(venue) {
    var marker = new google.maps.Marker({
      map: scope.map,
      position: {
        lat: venue.location.lat, 
        lng: venue.location.lng,
      },
      animation: google.maps.Animation.DROP,
    });

    marker.addListener('click', function() {
      location.hash = '#detail=' + venue.id;
    });

    scope.markers.push(marker);

    return marker;
  }

  function createResultItem(venue) {
    var icon = venue.categories[0].icon;
    var img = document.createElement('img');
    img.className = 'result__icon';
    img.src = icon.prefix + RESULT_IMG_SIZE + icon.suffix;
    img.style.backgroundColor = '#' + (venue.ratingColor || 'ccc');

    var title = document.createElement('div');
    title.className = 'result__title'
    title.innerText = venue.name;

    var type = document.createElement('div');
    type.className = 'result__type'
    type.innerText = venue.categories[0].name;

    var rating = document.createElement('div');
    rating.className = 'result__rating'
    rating.innerText = Array(Math.round((venue.rating || 0) / 2) + 1).join('⭐');

    var distance = document.createElement('div');
    distance.className = 'result__distance'
    distance.innerText = venue.location.distance + 'm';

    var link = document.createElement('a');
    link.className = 'result';
    link.href = '#detail=' + venue.id;
    link.appendChild(img);
    link.appendChild(title);
    link.appendChild(rating);
    link.appendChild(type);
    link.appendChild(distance);

    return link;
  }

  // Adjust map to show all markers taking in consideration content overlay.
  function centerMap() {
    var bounds = new google.maps.LatLngBounds();

    // My location
    bounds.extend(scope.locationMarker.position);

    // Markers
    for (var i = 0; i < scope.markers.length; i++) {
      var marker = scope.markers[i];
      bounds.extend(marker.position);
    }

    // Adjust overlay offset
    var contentBounds = elements.content.getBoundingClientRect();
    var bottomOffset = contentBounds.y || contentBounds.top;
    scope.map.fitBounds(bounds);
    var zoom = scope.map.getZoom();
    var proj = scope.map.getProjection();
    var point1 = proj.fromLatLngToPoint(bounds.getSouthWest());
    var point2 = new google.maps.Point(0, (bottomOffset / Math.pow(2, zoom)));
    var newPoint = proj.fromPointToLatLng(new google.maps.Point(
      point1.x - point2.x,
      point1.y + point2.y
    ));

    bounds.extend(newPoint);
    scope.map.fitBounds(bounds);
    
    var zoom = Math.min(18, scope.map.getZoom());
    scope.map.setZoom(zoom);
  }

  // ---------------------------------------------------------------------------
  // Detail -------------------------------------------------------------------

  /**
   * Clear previous data
   */
  function clearDetails() {
    elements.detailTitle.innerText = '';
    elements.detailCategory.innerText = '';
    elements.detailRating.innerText = '';
    elements.detailPrice.innerText = '';
    elements.detailAddress.innerText = '';
    
    while (elements.detailPhotos.firstChild) {
      elements.detailPhotos.removeChild(elements.detailPhotos.firstChild);
    }
  }

  /**
   * Retrieves detailed data about a specific venue
   * @param {string} venueId 
   */
  function fetchDetail(venueId) {
    var url = '//api.foursquare.com/v2/venues/' + venueId +
      '?oauth_token=' + scope.foursquareAccessToken +
      '&v=20171001';

    fetchJson(url)
      .then(onDetailResponse, onRequestError);
  }

  function onDetailResponse(data) {
    var venue = data.response.venue;
    var priceMarks = (venue.price && venue.price.tier) || 0;
    var ratingMarks = Math.round((venue.rating || 0) / 2);

    elements.detailTitle.innerText = venue.name;
    elements.detailCategory.innerText = venue.categories[0].name;
    elements.detailRating.innerText = Array(ratingMarks + 1).join('⭐️');
    elements.detailPrice.innerText = Array(priceMarks + 1).join('💲');
    elements.detailAddress.innerText = venue.location.formattedAddress.join('\n');

    createResultMarker(venue);
    centerMap();

    var photos = (venue.photos 
      && venue.photos.groups
      && venue.photos.groups.length > 0
      && venue.photos.groups[0].items) || [];

    for (var i = 0; i < photos.length; i++) {
      var photo = photos[i];
      var img = document.createElement('img');
      img.src = photo.prefix + DETAIL_IMG_SIZE + photo.suffix;
      img.className = 'detail__photo';
      elements.detailPhotos.appendChild(img);
    }
  }

  // ---------------------------------------------------------------------------
  // Event bindings ------------------------------------------------------------
  elements.loginBtn.addEventListener('click', function() {
    location.href = FOURSQUARE_CONNECT_URL;
  });

  elements.searchInput.addEventListener('keypress', function(event) {
    if (event.keyCode === KEY_ENTER) {
      location.hash = '#search=' + encodeURIComponent(elements.searchInput.value)
      return false;
    }
    return true;
  });

  elements.resultsClearBtn.addEventListener('click', function() {
    elements.searchInput.value = '';
    scope.latLng = null;
    scope.address = null;
    scope.radius = null;
    location.hash = '';
  });

  elements.resultsRadiusBtn.addEventListener('click', adjustRadius);
})();
