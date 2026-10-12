import { Marker } from "react-map-gl/maplibre";
import { IoArrowBackSharp } from "react-icons/io5";
import { IoSchoolOutline } from "react-icons/io5";
import { Link } from "react-router-dom";
import { TbWorld } from "react-icons/tb";
import { MdEmail } from "react-icons/md";
import { FaPhone } from "react-icons/fa6";
import { PiTrainBold } from "react-icons/pi";
import { BsFillBusFrontFill } from "react-icons/bs";

import UrbanDataObject from "./UrbanDataObject.jsx";
/**
 * Handles the link clicking event.
 *
 * Opens link in a new tab instead of overwritting current tab.
 *
 * @param {MouseEvent} event - Click event triggered by user.
 * @listens click - Event listener is attached to a <a> element
 *
 * @author Jia Yang
 */
const handleLinkClick = (event) => {
  event.preventDefault();
  window.open(event.target.href, "_blank", "noopener,noreferrer");
  // the third param is for security
};

/**
 * Inline styling for School Icon
 */
const primaryColor = "blue";
const styles = {
  iconContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: "50%",
    border: "2.4px solid " + primaryColor,
    backgroundColor: "white",
    padding: 4,
  },
  icon: {
    color: primaryColor,
  },
};

/**
 * Models a Primary / Secondaary School object using data from data.gov.sg
 *
 * @class School
 * @classdesc supports getters, rendering of side panel and marker
 */
class School extends UrbanDataObject {
  /**
   * constructor for School object
   *
   * @constructs a School object
   * @param {string} school_name
   * @param {string} address of school
   * @param {string} postal_code of school
   * @param {string} url_address of school website
   * @param {string} contact_number of school general office
   * @param {string} school_email
   * @param {string} nearest_mrt to the school
   * @param {string} bus_services to get to the school
   * @param {string} latitude
   * @param {string} longitude
   */
  constructor(
    school_name,
    address,
    postal_code,
    url_address,
    contact_number,
    school_email,
    nearest_mrt,
    bus_services,
    latitude,
    longitude
  ) {
    super(longitude, latitude);
    this.school_name = school_name;
    this.address = address;
    this.postal_code = postal_code;
    this.url_address = url_address;
    this.contact_number = contact_number;
    this.school_email = school_email;
    this.nearest_mrt = nearest_mrt;
    this.bus_services = bus_services;
  }

  getSchoolName() {
    return this.school_name;
  }

  getAddress() {
    return this.address;
  }

  getPostalCode() {
    return this.postal_code;
  }

  getURLAddress() {
    return this.url_address;
  }

  getContactNumber() {
    return this.contact_number;
  }

  getSchoolEmail() {
    return this.school_email;
  }

  getNearestMRT() {
    return this.nearest_mrt;
  }

  getBusServices() {
    return this.bus_services;
  }

  /**
   * Returns <Marker /> component initialised with the school's coordinates
   * and icon.
   *
   * @param {function} pushCache
   * @return <Marker /> from maplibre
   *
   */
  getSchoolMapIcon({ pushCache }) {
    return (
      <Marker
        school_name={this.school_name}
        latitude={this.getLatitude()}
        longitude={this.getLongitude()}
        cursor="pointer"
        onClick={(e) => {
          e.originalEvent.stopPropagation();
          pushCache(this);
        }}
      >
        <div style={styles.iconContainer}>
          <IoSchoolOutline cursor="pointer" size={22} style={styles.icon} />
        </div>
      </Marker>
    );
  }

  /**
   * Renders side panel by creating <div> and <p> elements
   *
   * @param {function} closeSidePanel
   * @para {function} popCache
   * @description loads relevant attributes from Primary School objects
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
          <h2 className="school-name">{this.school_name}</h2>
          <h5 className="school-address">{this.address}</h5>
          <h5 className="school-postal-code">{this.postal_code}</h5>

          <div className="school-details">
            <p>
              <FaPhone /> {this.contact_number}
            </p>
            <p>
              <TbWorld />{" "}
              <a href={this.url_address} onClick={handleLinkClick}>
                Official Website
              </a>
            </p>
            <p>
              <MdEmail /> {this.school_email}
            </p>
            <p>
              <PiTrainBold /> {this.nearest_mrt}
            </p>
            <p>
              <BsFillBusFrontFill /> {this.bus_services}
            </p>
          </div>
        </div>
      </div>
    );
  }
}

export default School;
