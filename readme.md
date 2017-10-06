# Venues demo webapp

Working demo: http://romulof.github.io/adyen-venues

### Structure

The project was coded in javascript vanilla. The the only aditions were these polyfills:
* Promise
* Fetch
* ClassList (only for IE9)
* Placeholders (only for IE9)

For stylesheets I used SASS with a minimal Gulp build procedure.

All the built files are stored at `docs` folder, because it's kind of a requirement for Github Pages.

### Macro Arquitecture

As the app is started you are required to connect with Foursquare.

Later you need to provide a location for the app to search for venues. You can choose to type an address or use the geolocation feature from your browser.

Both geolocation or address are given to Google Maps Geocoder API to normalize the output to a readable address and geolocation.

The map shows the desired location and contacts Foursquare API to list venues near that location.
The locations are received and displayed in a list format, as well markers on the map.

Here you can change the search distance using a discrete button on the top right corner, which will trigger another request to Foursquare API.

Clicking on the markers or the list items will switch to a detail view, then Foursquare will be contacted again to provide aditional info.

### Difficulties

Google Maps API does not help when your UI overlays their map. Using ther bound and center helpers will not take into account the area of the map you are overlaying. So I had to make some calculations by hand.

Supporting IE 9 was a total pain in the ass. I could swear it supported flexbox, but IE never disapoints and I had to rewite lots of CSS to put things into place. All that were nothing near the crown jewel: CORS support totally messed up on that browser, and Fetch pollyfill had dropped support a long time ago, so I had to write a very simple pollyfill just for the required cases to work. All specific code for IE9 is stored separately in `shame.js` and `shame.css`, and linked using conditional comments to not break the other browsers.
