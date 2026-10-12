import "./Sidebar.css";
import { IoArrowBackSharp } from "react-icons/io5";
import { FaMosquito } from "react-icons/fa6";
import { Marker } from "react-map-gl/maplibre";
import UrbanDataObject from "./UrbanDataObject.jsx";
/**
 * inline styling for Dengue icon
 */
const primaryColor = "red";
const styles = {
  iconContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: "50%",
    border: "2.5px solid " + primaryColor,
    backgroundColor: "white",
    padding: 4,
  },
  icon: {
    color: primaryColor,
  },
};

/**
 * Abstraction for an Dengue object using attributes from data.gov.sg
 *
 * @class Dengue
 * @classdesc supports setters and getters, and rendering of marker
 */
class Dengue extends UrbanDataObject {
  /**
   * Constructs a Dengue object by initialisng relevant attributes.
   *
   * @constructs Dengue object
   * @param {string} id
   * @param {string} latitude
   * @param {string} longitude
   * * @param {string} caseSize
   */
  constructor(id, latitude, longitude, caseSize) {
    super(longitude, latitude);
    this.id = id;
    this.caseSize = caseSize;
  }
  /**
   * Returns <Marker /> component initialised with the Dengue's coordinate
   * and icon.
   *
   * @param {function} pushCache
   * @return <Marker /> from maplibre
   */
  getMapIcon({ pushCache }) {
    return (
      <Marker
        latitude={this.getLatitude()}
        longitude={this.getLongitude()}
        key={this.id}
        cursor="pointer"
        onClick={(e) => {
          e.originalEvent.stopPropagation();
          pushCache(this);
        }}
      >
        <div style={styles.iconContainer}>
          <FaMosquito size={22} cursor="pointer" style={styles.icon} />
        </div>
      </Marker>
    );
  }

  /**
   * Renders side panel by creating <div> and <p> elements
   *
   * @param {function} closeSidePanel
   * @para {function} popCache
   * @description loads relevant attributes from Dengue objects
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
          <h2>Dengue id: {this.id}</h2>
          <p>Case Size: {this.caseSize}</p>
        </div>
      </div>
    );
  }
}

export default Dengue;
