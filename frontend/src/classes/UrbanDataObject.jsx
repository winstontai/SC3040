/**
 * Abstraction for an UrbanDataObject
 *
 * @class UrbanDataObject
 * @classdesc supports setters and getters, and rendering of marker
 */
class UrbanDataObject {
  /**
   * Constructs a UrbanDataObject object by initialisng relevant attributes.
   *
   * @constructs UrbanDataObject object
   * @param {string} longitude
   * @param {string} latitude
   */
  constructor(longitude, latitude) {
    this.longitude = longitude;
    this.latitude = latitude;
  }

  getLatitude() {
    return this.latitude;
  }

  getLongitude() {
    return this.longitude;
  }
}

export default UrbanDataObject;
