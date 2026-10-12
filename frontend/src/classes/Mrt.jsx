import { Marker } from "react-map-gl/dist/esm/exports-maplibre";
import { FaTrainSubway } from "react-icons/fa6";
import { IoArrowBackSharp } from "react-icons/io5";
import UrbanDataObject from "./UrbanDataObject.jsx";

/**
 * Inline sytlings for MRT icon
 */
const primaryColor = "green";
const styles = {
  iconContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: "50%",
    border: "2.5px solid " + primaryColor,
    backgroundColor: "white",
    padding: 5,
  },
  icon: {
    color: primaryColor,
  },
};

/**
 * Models a MRT station object using data from data.gov.sg
 *
 * @class MRT
 * @classdesc supports getters, rendering of side panel and marker
 */
class Mrt extends UrbanDataObject {
  /**
   * constructor for MRT station object
   *
   * @constructs a MRT station object
   * @param name of MRT station
   * @param latitude of MRT station
   * @param longitude of MRT station
   */
  constructor(name, latitude, longitude) {
    super(longitude, latitude);
    this.name = name;
  }

  getMrtName() {
    return this.name;
  }

  /**
   * Returns <Marker /> component initialised with the MRT station's coordinates
   * and icon.
   *
   * @param {function} pushCache
   * @return <Marker /> from maplibre
   *
   */
  getMapIconMRT({ pushCache }) {
    return (
      <Marker
        name={this.name}
        latitude={this.getLatitude()}
        longitude={this.getLongitude()}
        cursor="pointer"
        onClick={(e) => {
          e.originalEvent.stopPropagation();
          pushCache(this);
        }}
      >
        <div style={styles.iconContainer}>
          <FaTrainSubway cursor="pointer" size={19} style={styles.icon} />
        </div>
      </Marker>
    );
  }

  /**
   * Renders side panel by creating <div> and <p> elements
   *
   * @param {function} closeSidePanel
   * @para {function} popCache
   * @description loads relevant attributes from MRT station objects
   * @return the rendered side panel
   */
  getSidePanel({ closeSidePanel, popCache }) {
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
          <h2 className="mrt-name">{this.name}</h2>
        </div>
      </div>
    );
  }
}

export default Mrt;
