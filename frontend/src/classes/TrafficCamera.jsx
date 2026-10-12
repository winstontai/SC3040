import "./Sidebar.css";
import { IoArrowBackSharp } from "react-icons/io5";
import { IoTimerSharp } from "react-icons/io5";
import { Marker } from "react-map-gl/maplibre";
import { PiSecurityCameraBold } from "react-icons/pi";
import UrbanDataObject from "./UrbanDataObject.jsx";

/**
 * Inline styling for Traffic Camera icons
 */
const primaryColor = "#F07B3F";

const styles = {
  iconContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: "50%",
    border: "2.4px solid" + primaryColor,
    backgroundColor: "white",
    padding: 4,
  },
  icon: {
    color: primaryColor,
  },
};

/**
 * Models a Traffic Camera object using data from data.gov.sg
 *
 * @class TrafficCamera
 * @classdesc supports getters, rendering of side panel and marker
 */
class TrafficCamera extends UrbanDataObject {
  /**
   * constructor for Traffic Camera object
   *
  * @constructs a Traffic Camera object
  * @param id of the traffic camera provided by LTA
  * @param url of image
  * @param latitude
  * @param longitude
  * @param timestamp - Time of acquisition of data from LTA's Datamall

  */
  constructor(id, url, latitude, longitude, timestamp) {
    super(longitude, latitude);
    this.id = id;
    this.url = url;
    this.timestamp = timestamp;
  }

  getUrl() {
    return this.url;
  }

  /**
   * Returns <Marker /> component initialised with the traffic camera's coordinates
   * and icon.
   *
   * @param {function} pushCache
   * @return <Marker /> from maplibre
   *
   */
  getMapIcon({ pushCache }) {
    return (
      <Marker
        key={this.id}
        latitude={this.getLatitude()}
        longitude={this.getLongitude()}
        onClick={() => {
          pushCache(this);
        }}
      >
        <div style={styles.iconContainer}>
          <PiSecurityCameraBold
            cursor="pointer"
            size={22}
            style={styles.icon}
          />
        </div>
      </Marker>
    );
  }

  /**
   * Renders side panel by creating <div> and <p> elements
   *
   * @param {function} closeSidePanel
   * @para {function} popCache
   * @description loads relevant attributes from Traffic Camera objects
   * @return the rendered side panel
   */
  getSidePanel({ closeSidePanel, popCache }) {
    const formatTimestamp = (timestamp) => {
      const date = new Date(timestamp);

      // Extract day, month, and year with padding
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = String(date.getFullYear()).slice(-2);

      // Extract hours, minutes, seconds, and AM/PM
      const hours = String(date.getHours() % 12 || 12).padStart(2, "0"); // 12-hour format
      const minutes = String(date.getMinutes()).padStart(2, "0");
      const seconds = String(date.getSeconds()).padStart(2, "0");
      const ampm = date.getHours() >= 12 ? "PM" : "AM";

      // Format it as dd/MM/yy hh:mm:ss AM/PM
      return `${day}/${month}/${year} ${hours}:${minutes}:${seconds} ${ampm}`;
    };

    return (
      <div className={`sidebar ${"open"}`}>
        <div className="sidebar-header">
          <button
            className="close-btn"
            onClick={() => {
              popCache();
            }}
          >
            <IoArrowBackSharp />
          </button>
          <button
            className="close-btn"
            onClick={() => {
              closeSidePanel();
            }}
          >
            ✕
          </button>
        </div>

        <div className="sidebar-content">
          <div>
            <img
              src={this.getUrl()}
              alt="Property"
              style={{
                width: "100%", // Makes the image stretch to fill the width of the container
                height: "auto", // Maintains the image's aspect ratio
                objectFit: "cover", // Ensures the image fills the container without distorting
              }}
            />
          </div>
          <h5 className="property-name">Traffic Camera ID: {this.id}</h5>
          <p className="sub-info">
            <IoTimerSharp /> {formatTimestamp(this.timestamp)}
          </p>
        </div>
      </div>
    );
  }
}

export default TrafficCamera;
