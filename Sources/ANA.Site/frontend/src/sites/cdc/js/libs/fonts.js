/**
 * Use Web Font Loader toolkit to load site fonts
 */
import WebFont from 'webfontloader';

WebFont.load({

  // NOTE: if you are running Adobe Creative Suite, be sure your fonts are not synced to your
  // system (or at least be aware that you may experience a false positive, in the event they
  // are only available as provided in your local environment)

  // NOTE: Be sure to use the correctly named object as needed for the service you are using

  // SEE: https://github.com/typekit/webfontloader for more details

  // if you have local fonts
  // custom: {
  //   families: ['Oswald','Libre Franklin'],
  //   urls: [`${asset.loc.FONTS}fonts.css`]
  // }

  // if you need google fonts
  // google: {
  //   families: ['Droid', 'Droid Sans'],

  //   // these events are available in all implementations
  //   loading: function () { console.log('loading'); },
  //   active: function () { console.log('active'); },
  //   inactive: function () { console.log('inactive'); },
  //   fontloading: function (familyName, fvd) { console.log('fontloading'); },
  //   fontactive: function (familyName, fvd) { console.log('fontactive'); },
  //   fontinactive: function (familyName, fvd) { console.log(familyName, fvd, 'fontinactive'); }
  // }

});
