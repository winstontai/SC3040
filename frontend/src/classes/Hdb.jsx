import "./Sidebar.css";
import { IoArrowBackSharp } from "react-icons/io5";
import { FaMosquito } from "react-icons/fa6";
import { FaTrainSubway } from "react-icons/fa6";
import { FaBed } from "react-icons/fa";
import { FaRestroom } from "react-icons/fa";
import { BsHouse } from "react-icons/bs";
import { Marker } from "react-map-gl/maplibre";
import { FaHome } from "react-icons/fa";
import UrbanDataObject from "./UrbanDataObject.jsx";
import Bar from "./Bar";
import { IoSchoolOutline } from "react-icons/io5";

const primaryColor = "#2D4059";
import Chart from "react-apexcharts";

/**
 * inline styling for HDB icon
 */
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
 * Abstraction for an HDB object using attributes from data.gov.sg
 *
 * @class Hdb
 * @classdesc supports setters and getters, and rendering of marker
 */
class Hdb extends UrbanDataObject {
  /**
   * Constructs a HDB object by initialisng relevant attributes.
   *
   * @constructs Hdb object
   * @param {string} month
   * @param {string} town
   * @param {string} block
   * @param {string} street_name
   * @param {string} storey_range
   * @param {string} floor_area_sqm
   * @param {string} flat_model
   * @param {string} lease_commence_date
   * @param {string} remaining_lease
   * @param {string} resale_price
   * @param {string} address
   * @param {string} latitude
   * @param {string} longitude
   */
  constructor(
    month,
    town,
    flat_type,
    block,
    street_name,
    storey_range,
    floor_area_sqm,
    flat_model,
    lease_commence_date,
    remaining_lease,
    resale_price,
    address,
    latitude,
    longitude
  ) {
    super(longitude, latitude);

    this.month = month;
    this.town = town;
    this.flat_type = flat_type;
    this.block = block;
    this.street_name = street_name;
    this.storey_range = storey_range;
    this.floor_area_sqm = floor_area_sqm;
    this.flat_model = flat_model;
    this.lease_commence_date = lease_commence_date;
    this.remaining_lease = remaining_lease;
    this.resale_price = resale_price;
    this.address = address;
    this.nearestSchools = [];
    this.nearestMRT = [];
    this.nearestTrafficCameras = [];
    this.nearestDengue = [];
  }

  setNearestSchools = (nearestSchools) => {
    this.nearestSchools = nearestSchools;
  };

  setNearestMRT = (nearestMRT) => {
    this.nearestMRT = nearestMRT;
  };

  setNearestTrafficCameras = (nearestCameras) => {
    this.nearestTrafficCameras = nearestCameras;
  };

  setNearestDengue = (nearestDengue) => {
    this.nearestDengue = nearestDengue;
  };

  getFlatType() {
    return this.flat_type;
  }

  getFullAddress() {
    return this.address + " " + this.block;
  }

  getLeaseLife() {
    return this.remaining_lease;
  }

  getPrice() {
    return this.resale_price;
  }

  /** 
   * Calculates the total weighted score based on proximity to the nearest
   * school, MRT, and dengue cluster.
   *
   * Each score is computed using a distance-based scoring method, and then
   * weighted according to the values provided in the `weights` parameter.
   *
   * @author: Bryan
   * 
   * @param {Object} weights - An object containing weight values for each
   * factor. 
   * @param {number} weights.school - The weight to apply to the school
   * proximity score. 
   * @param {number} weights.mrt - The weight to apply to the
   * MRT proximity score. 
   * @param {number} weights.dengue - The weight to apply to
   * the dengue proximity score.
   * 
   * @returns {number|undefined} The total weighted score, or `undefined` if
   * weights are not provided.
   */

  getTotalScore(weights) {
    const schoolTarget = this.nearestSchools?.[0];
    const mrtTarget = this.nearestMRT?.[0];
    const dengueTarget = this.nearestDengue?.[0];

    const schoolScore = schoolTarget ? this.getDistanceScore(schoolTarget) : 0;
    const mrtScore = mrtTarget ? this.getDistanceScore(mrtTarget) : 0;
    const dengueScore = dengueTarget
      ? this.getDengueDistanceScore(dengueTarget)
      : 0;

    return (
      weights &&
      weights.school * schoolScore +
        weights.mrt * mrtScore +
        weights.dengue * dengueScore
    );
  }

  getDistanceFromHDBinKM(target) {
    const KM_PER_DEGREE = 111;

    const euclideanDistance = (obj, target) => {
      const dx = obj.longitude - target.longitude;
      const dy = obj.latitude - target.latitude;
      return Math.sqrt(dx * dx + dy * dy);
    };

    return euclideanDistance(this, target) * KM_PER_DEGREE;
  }

  getDistanceScore(target) {
    if (!target) return 0;

    const MAX_WALKING_DIST_KM = 2;
    const distKm = this.getDistanceFromHDBinKM(target);

    // Base score: closer = higher score (clamped between 0 and 1)
    let score = Math.max(0, 1 - distKm / MAX_WALKING_DIST_KM);

    return score;
  }

  getDengueDistanceScore(target) {
    if (!target) return 0;

    const MAX_WALKING_DIST_KM = 5;
    const distKm = this.getDistanceFromHDBinKM(target);

    let score = Math.min(1, distKm / MAX_WALKING_DIST_KM);

    return score;
  }

  /**
   * Returns <Marker /> component initialised with the HDB flat's coordinate
   * and icon.
   *
   * @param {function} setActiveHdb, from useState()
   * @return <Marker /> from maplibre
   */
  getMapIcon({ setActiveHdb }) {
    return (
      <Marker
        latitude={this.getLatitude()}
        longitude={this.getLongitude()}
        key={`marker-${this.key}`}
        cursor="pointer"
        onClick={(e) => {
          e.originalEvent.stopPropagation();
          setActiveHdb(this);
        }}
      >
        <div style={styles.iconContainer}>
          <FaHome size={30} cursor="pointer" style={styles.icon} />
        </div>
      </Marker>
    );
  }

  drawPriceDistributionGraph(flats) {
    const getPriceStats = (flats) => {
      let array = [];
      for (let i = 0; i < flats.length; i++) {
        array.push(Number(flats[i].resale_price));
      }
      array.sort((a, b) => a - b);
      const getMedian = (array) => {
        const mi = Math.floor(array.length / 2);
        return array.length % 2 == 0
          ? (array[mi - 1] + array[mi]) / 2
          : array[mi];
      };
      const getQuartile = (arr, q) => {
        const mid = Math.floor(arr.length / 2);
        const lowerHalf = arr.slice(0, mid);
        const upperHalf = arr.slice(arr.length % 2 === 0 ? mid : mid + 1);
        return q === 1 ? getMedian(lowerHalf) : getMedian(upperHalf);
      };
      const q2 = getMedian(array);
      const q1 = getQuartile(array, 1);
      const q3 = getQuartile(array, 3);
      const IQR = q3 - q1;
      const lo = array.find((x) => x >= q1 - 1.5 * IQR) || array[0];
      const hi =
        array
          .slice()
          .reverse()
          .find((x) => x <= q3 + 1.5 * IQR) || array[array.length - 1];
      // console.log(array);
      return { lo, q1, q2, q3, hi };
    };

    const stats = getPriceStats(flats);

    const boxplotData = {
      x: "Price",
      y: [stats.lo, stats.q1, stats.q2, stats.q3, stats.hi],
      goals: [
        {
          value: this.resale_price,
          strokeWidth: 10,
          strokeHeight: 0,
          strokeLineCap: "round",
          strokeColor: "#F283B6",
        },
      ],
    };

    const options = {
      chart: {
        type: "boxPlot",
        height: 150,
        width: "80%",
        toolbar: {
          show: false,
        },
      },
      title: {
        text: "Price Distribution",
        align: "left",
        style: {
          fontSize: "0",
        },
      },
      plotOptions: {
        bar: {
          horizontal: true,
          barHeight: "40%",
        },
        boxPlot: {
          colors: {
            upper: "#B6C454",
            lower: "#EDBFB7",
          },
        },
      },
      stroke: {
        colors: ["#333"],
      },
    };
    return { data: boxplotData, opt: options };
  }

  /**
   * Renders side panel by creating <div> and <p> elements
   *
   * @param {function} closeSidePanel
   * @para {function} popCache
   * @description loads relevant attributes from HDB objects
   * @return the rendered side panel
   */
  getSidePanel({ closeSidePanel, pushCache, popCache, filteredHdbs }) {
    const formatPrice = (price) => {
      return Number(price).toLocaleString();
    };

    const { data, opt } = this.drawPriceDistributionGraph(filteredHdbs || []);

    return (
      <>
        <div className={`sidebar ${"open"}`}>
          <div className="sidebar-header">
            <button className="close-btn" onClick={() => {}}></button>
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
            <h2 className="rent-price">S${formatPrice(this.resale_price)}</h2>
            <div className="boxplot">
              <Chart
                options={opt}
                series={[{ data: [data] }]}
                type="boxPlot"
                height={150}
              />
            </div>
            <h5 className="property-name">{this.address}</h5>
            <p className="sub-info">Lease hremaining: {this.remaining_lease}</p>

            <div className="property-details">
              <p>
                <FaBed /> {this.flat_type}
              </p>
              <p>
                <BsHouse /> {this.floor_area_sqm} m²
              </p>
              <p>
                <IoSchoolOutline /> Nearest School:{" "}
                {this.nearestSchools?.[0]
                  ? `${this.getDistanceFromHDBinKM(
                      this.nearestSchools[0]
                    ).toFixed(2)} km`
                  : "N/A"}
              </p>
              {this.nearestSchools.map((school, index) => {
                return (
                  <div
                    key={index}
                    className="list-item"
                    onClick={() => {
                      pushCache(school);
                    }}
                  >
                    {school.school_name}
                    <Bar value={this.getDistanceScore(school)} />
                  </div>
                );
              })}
              <p>
                <FaTrainSubway /> Nearest MRT:{" "}
                {this.nearestMRT?.[0]
                  ? `${this.getDistanceFromHDBinKM(this.nearestMRT[0]).toFixed(
                      2
                    )} km`
                  : "N/A"}
              </p>
              {this.nearestMRT.map((mrt, index) => {
                return (
                  <div
                    key={index}
                    className="list-item"
                    onClick={() => {
                      pushCache(mrt);
                    }}
                  >
                    {mrt.name}
                    <Bar value={this.getDistanceScore(mrt)} />
                  </div>
                );
              })}
              <p>
                <FaMosquito /> Nearest Dengue Cluster:{" "}
                {this.nearestDengue?.[0]
                  ? `${this.getDistanceFromHDBinKM(
                      this.nearestDengue[0]
                    ).toFixed(2)} km`
                  : "N/A"}
              </p>
              {this.nearestDengue.map((dengue, index) => {
                return (
                  <div
                    key={index}
                    className="list-item"
                    onClick={() => {
                      pushCache(dengue);
                    }}
                  >
                    Cluster Size: {dengue.caseSize} Cases
                    <Bar value={this.getDengueDistanceScore(dengue)} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </>
    );
  }
}

export default Hdb;
