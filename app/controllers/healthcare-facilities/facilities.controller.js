/* eslint-disable no-plusplus */
/* eslint-disable no-console */
const { sms } = require('../../config/africastalking');

const { menu } = require('../../config/menu-builder');

const {
  fetchPlaceDetails,
  fetchDirections,
  fetchPlaceId,
} = require('../../utils/maps_query');

const { fetchPlaceByFacility } = require('../../utils/controller_queries');

const { formatTextDirections } = require('../../utils/formatted_texts');

const { getSelectedText } = require('../../utils/dynamic_response');

let origin = '';

let destination = '';

let responseMessage = '';

let facility = '';

let facilities = '';

const clearState = () => {
  origin = '';
  destination = '';
  responseMessage = '';
  facility = '';
  facilities = '';
};

module.exports = async function ManualController(req, res) {
  try {
    /** ---------------------------------------------------
     *   ──────┤ Entry -- specify healthcare ├──────    ***********
     ---------------------------------------------------* */
    menu.state('entry-point-to-healthcare-facilities-controller', {
      run: () => {
        clearState();
        menu.con('1. Nearby hospitals'
            + '\n2. Nearby pharmacies'
            + '\n3. Nearby clinics');
      },
      next: {
        '*': 'specify-user-location',
      },
    });

    /** ---------------------------------------------------
     *   ──────┤ Specify location ├──────    ***********
     ---------------------------------------------------* */
    menu.state('specify-user-location', {
      run: () => {
        facility = menu.val;
        menu.con('Please enter your current location for accurate results (city, town or area)');
      },
      next: {
        '*': 'display-facilities',
      },
    });

    /** ---------------------------------------------------
     *   ──────┤ Facilities display ├──────    ***********
     ---------------------------------------------------* */
    menu.state('display-facilities', {
      run: async () => {
        let userLocation = menu.val === '1' ? 'Juja' : menu.val;

        origin = userLocation;

        facilities = await fetchPlaceByFacility(facility, userLocation);

        for (let i = 0; i < 5 && i < facilities.length; i++) {
          responseMessage += `${i + 1}. ${facilities[i].name}\n`;
        }

        userLocation = '';

        facilities = '';

        menu.con(responseMessage);
      },

      next: {
        '*': 'final-output',
      },
    });

    /** ---------------------------------------------------
     *   ──────┤ Return output ├──────    ***********
     ---------------------------------------------------* */
    menu.state('final-output', {
      run: async () => {
        facilities = '';

        destination = getSelectedText(responseMessage, menu.val);

        const destinationID = await fetchPlaceId(destination);

        const originID = await fetchPlaceId(origin);

        const facilityDetails = await fetchPlaceDetails(destinationID);

        const directions = await fetchDirections(originID, destinationID);

        menu.end(`
        ${facilityDetails.name}.\n
        Address: ${facilityDetails.formatted_address}
        Contact: ${facilityDetails.phoneNumber} \n
        More details and directions will be sent to your phone number
        `);

        const formattedDirections = formatTextDirections(directions);

        const moreDetails = {};

        if (facilityDetails.website !== undefined) {
          moreDetails.Website = facilityDetails.website;
        }

        if (facilityDetails.mapPin !== undefined) {
          moreDetails.Location = facilityDetails.mapPin;
        }

        if (facilityDetails.phoneNumber !== undefined) {
          moreDetails.Phone = facilityDetails.phoneNumber;
        }

        if (facilityDetails.rating !== undefined) {
          moreDetails.Rating = facilityDetails.rating;
        }

        const formattedMoreDetails = Object.entries(moreDetails)
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n');

        try {
          await sms.send({
            to: menu.args.phoneNumber,
            message: `${formattedMoreDetails} \n\n ${formattedDirections}`,
          });
        } catch (error) {
          console.error(error);
        }

        clearState();
      },
    });

    menu.run(req.body, (ussdResult) => {
      res.send(ussdResult);
    });
  } catch (error) {
    console.error(error);
  }
};
