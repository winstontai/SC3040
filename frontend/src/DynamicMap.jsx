import "maplibre-gl/dist/maplibre-gl.css";
import { Map } from "react-map-gl/maplibre";
import { useState, useEffect, useMemo, useRef, useContext } from "react";

import TrafficCamera from "./classes/TrafficCamera.jsx";
import Hdb from "./classes/Hdb.jsx";
import Dengue from "./classes/Dengue.jsx";
import Switch from "@mui/material/Switch";
import Mrt from "./classes/Mrt.jsx";
import School from "./classes/School.jsx";
import HDBContext from "./HDBContext.jsx";
import MapControl from "./MapControl.jsx";
import "./classes/Sidebar.css";
import WeightSliders from "./WeightSliders";
import Bar from "./classes/Bar";

const initialLongitude = 103.81895378099354;
const initialLatitude = 1.356474868742945;
const initialZoom = 11.6;

/**
 * attempts to fetch data 
 */
const fetchTrafficCameras = async (setTrafficCameras) => {
  try {
    const response = await fetch(
      "https://api.data.gov.sg/v1/transport/traffic-images"
    );
    const data = await response.json();

    if (data) {
      const trafficCameras = data.items[0].cameras.map((item) => {
        return new TrafficCamera(
          item.camera_id,
          item.image,
          item.location.latitude,
          item.location.longitude,
          item.timestamp
        );
      });
      setTrafficCameras(trafficCameras);
    }
  } catch (error) {
    console.error("Error fetching:", error);
  }
};

const fetchDengue = async (setDengue) => {
  try {
    const response = await fetch("./dengue.json");
    const data = await response.json();
    const dengues = data.map((item) => {
      const dengue = new Dengue(
        item.properties.OBJECTID,
        item.latitude,
        item.longitude,
        item.properties.CASE_SIZE
      );
      return dengue;
    });
    setDengue(dengues);
  } catch (error) {
    console.error("Error fetching:", error);
  }
};

const fetchMrt = async (setMRT) => {
  try {
    const response = await fetch("./LTAMRTStationExitUpdated.json");
    const data = await response.json();

    if (data) {
      const MRTs = data.features.map((item) => {
        return new Mrt(
          item.properties.Name,
          item.geometry.coordinates[1],
          item.geometry.coordinates[0]
        );
      });

      setMRT(MRTs);
    }
  } catch (error) {
    console.error("Error fetching MRT stations:", error);
  }
};

const fetchSchool = async (setSchool) => {
  try {
    const response = await fetch("./schools.json");
    const data = await response.json();

    if (data) {
      const Schools = data.map((item) => {
        return new School(
          item.school_name,
          item.address,
          item.postal_code,
          item.url_address,
          item.telephone_no,
          item.email_address,
          item.mrt_desc,
          item.bus_desc,
          item.latitude,
          item.longitude
        );
      });
      setSchool(Schools);
    }
  } catch (error) {
    console.error("Error fetching schools: ", error);
  }
};

/**
 * Renders an interactable map component using maplibre
 *
 */
function DynamicMap() {
  const { filteredHdbs, setFilteredHdbs } = useContext(HDBContext);
  const [recommendedHdbs, setRecommendedHdbs] = useState([]);
  const [trafficCameras, setTrafficCameras] = useState([]);
  const [dengues, setDengues] = useState([]);
  const [MRTs, setMRTs] = useState([]);
  const [Schools, setSchools] = useState([]);

  const [displayTrafficCameras, setDisplayTrafficCameras] = useState([]);
  const [displayDengue, setDisplayDengue] = useState([]);
  const [displayHdbs, setDisplayHdbs] = useState([]);
  const [displayMRTs, setDisplayMRTs] = useState([]);
  const [displaySchools, setDisplaySchools] = useState([]);

  const [showHdb, setShowHdb] = useState(true);
  const [showTrafficCamera, setShowTrafficCamera] = useState(true);
  const [showDengue, setShowDengue] = useState(true);
  const [showMRT, setShowMRT] = useState(true);
  const [showSchool, setShowSchool] = useState(true);

  const [cache, setCache] = useState([]); // cache state for side panel

  const [weights, setWeights] = useState({
    school: 0.25,
    mrt: 0.25,
    dengue: 0.25,
  });

  const mapRef = useRef();

  const pushCache = (element) => {
    setCache((prevCache) => [...prevCache, element]);
  };

  const popCache = () => {
    setCache((prevCache) => prevCache.slice(0, -1));
  };

  const clearCache = () => {
    setCache([]);
  };

  /**
   * Specify the sequence of events that happens for each display arrat when a valid object is set.
   *
   * @param {class} element - a valid class with longitude and latitude. Refers to a HDB
   */
  const setActiveHdb = (element) => {
    pushCache(element);

    setDisplayTrafficCameras(element.nearestTrafficCameras);
    setDisplayMRTs(element.nearestMRT);
    setDisplayDengue(element.nearestDengue);
    setDisplaySchools(element.nearestSchools);
    setDisplayHdbs([element]);
  };

  /**
   * Clean up events after closing side panel
   */
  const closeSidePanel = () => {
    clearCache();
    setDisplayTrafficCameras([]);
    setDisplayDengue([]);
    setDisplayHdbs(filteredHdbs);
    setDisplayMRTs([]);
    setDisplaySchools([]);
  };

  /**
   * Calculates Euclidean Distance between two positions
   *
   * @param obj - a valid class object
   * @param target - a valid class boject
   * @return the euclidean distnace
   */
  const euclideanDistance = (obj, target) => {
    const dx = obj.longitude - target.longitude;
    const dy = obj.latitude - target.latitude;
    return Math.sqrt(dx * dx + dy * dy);
  };

  /**
   * Wrapper for euclideanDistance.
   *
   * @param locations - array of objects with longitude and latitude attributes
   * @param target - target location with longitude and latitude attributes
   * @return sorted array in non-decreasing order of euclidean distance
   */
  const getNearestNLocations = (locations, target, n) => {
    return locations
      .sort((a, b) => {
        const distanceA = euclideanDistance(a, target);
        const distanceB = euclideanDistance(b, target);
        return distanceA - distanceB;
      })
      .slice(0, n);
  };

  /*
   * Call maplibre method flyTo on interaction with Marker by
   * zooming on that location.
   *
   * @param latitude of map object
   * @param longitude of map object
   */
  const flyToLocation = (latitude, longitude) => {
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [longitude, latitude],
        zoom: mapRef.current.getZoom(),
        speed: 0.25,
      });
    }
  };

  /**
   * On load,set TrafficCamera, MRT and School arrays
   */
  useMemo(() => {
    fetchTrafficCameras(setTrafficCameras);
    fetchDengue(setDengues);
    fetchMrt(setMRTs);
    fetchSchool(setSchools);
    setDisplayHdbs(filteredHdbs);
  }, []);

  /**
   * On change of cahce array,
   * if there are elements on the stack, pop the stack
   * fly to location in the element
   */
  useEffect(() => {
    if (cache.length > 0) {
      const activeElement = cache[cache.length - 1];
      flyToLocation(activeElement.latitude, activeElement.longitude);
    }
  }, [cache]);

  useMemo(() => {
    const allLoaded =
      filteredHdbs.length > 0 &&
      MRTs.length > 0 &&
      Schools.length > 0 &&
      trafficCameras.length > 0;

    if (allLoaded) {
      console.log("Running calculation...");
      filteredHdbs.forEach((hdb) => {
        hdb.setNearestMRT(getNearestNLocations(MRTs, hdb, 1));
        hdb.setNearestSchools(getNearestNLocations(Schools, hdb, 3));
        hdb.setNearestTrafficCameras(
          getNearestNLocations(trafficCameras, hdb, 5)
        );
        hdb.setNearestDengue(getNearestNLocations(dengues, hdb, 1));
      });
    }
    console.log("[+] in useEffect() to get nearest attributes: done");
  }, [filteredHdbs, MRTs, Schools, trafficCameras]);

  useEffect(() => {
    console.log("update ranking");
    const sorted = [...filteredHdbs].sort(
      (a, b) => b.getTotalScore(weights) - a.getTotalScore(weights)
    );

    // console.log(sorted);

    const seen = new Set();
    const uniqueHdbs = sorted.filter((hdb) => {
      if (seen.has(hdb.getFullAddress())) return false;
      seen.add(hdb.getFullAddress());
      return true;
    });

    console.log("sorted hdb by score");
    setRecommendedHdbs(uniqueHdbs);
  }, [weights]);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      {/* Side Panel */}
      {cache.length > 0 &&
        cache[cache.length - 1].getSidePanel({
          closeSidePanel,
          pushCache,
          popCache,
          filteredHdbs,
        })}

      {cache.length == 0 && (
        <div className={`sidebar ${"open"}`}>
          <div className="sidebar-header">HDB Recommendation</div>
          <div className="sidebar-content">
            <WeightSliders weights={weights} onChange={setWeights} />
          </div>
          <div>
            {recommendedHdbs.length > 0 &&
              recommendedHdbs.map((hdb, index) => {
                return (
                  <div
                    key={index}
                    className="list-item"
                    onClick={() => {
                      // console.log("clicked", hdb);
                      setActiveHdb(hdb);
                    }}
                  >
                    {hdb.address}
                    <Bar value={hdb.getTotalScore(weights)} />
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Toggle Buttons */}
      {cache.length > 0 && (
        <div
          style={{
            position: "absolute",
            zIndex: 1,
            width: "100%",
            display: "flex",
            justifyContent: "center",
            background: "white",
          }}
        >
          <div>
            <Switch
              defaultChecked
              onChange={() => setShowDengue(!showDengue)}
            />
            <span>Display Dengue</span>
          </div>
          <div>
            <Switch
              defaultChecked
              onChange={() => setShowTrafficCamera(!showTrafficCamera)}
            />
            <span>Display Traffic Camera</span>
          </div>
          <div>
            <Switch defaultChecked onChange={() => setShowMRT(!showMRT)} />
            <span>Display MRT</span>
          </div>
          <div>
            <Switch
              defaultChecked
              onChange={() => setShowSchool(!showSchool)}
            />
            <span>Display School</span>
          </div>
        </div>
      )}

      <Map
        ref={mapRef}
        maxBounds={[103.596, 1.1443, 104.1, 1.4835]}
        mapStyle="https://www.onemap.gov.sg/maps/json/raster/mbstyle/Default.json"
        initialViewState={{
          longitude: initialLongitude,
          latitude: initialLatitude,
          zoom: initialZoom,
        }}
      >
        <MapControl />

        {/* Toggle Display of Dengue Markers and iterates through displayTrafficCamera array to set Marker*/}
        {showTrafficCamera &&
          displayTrafficCameras.map((trafficCamera) =>
            trafficCamera.getMapIcon({ pushCache })
          )}

        {/* Toggle Display of Traffic Camera Markers and iterates through displayTrafficCamera array to set Marker*/}
        {showDengue &&
          displayDengue.map((dengue) => dengue.getMapIcon({ pushCache }))}

        {/* Toggle Display of MRT station Markers and iterates through displayMRT array to set Marker*/}
        {showMRT && displayMRTs.map((MRT) => MRT.getMapIconMRT({ pushCache }))}

        {/* Toggle Display of School Markers */}
        {showSchool &&
          displaySchools.map((School) =>
            School.getSchoolMapIcon({ pushCache })
          )}

        {/* Toggle Display of HDB Markers and iterates through displayHdbs array to set Marker*/}
        {showHdb && displayHdbs.map((hdb) => hdb.getMapIcon({ setActiveHdb }))}
      </Map>
    </div>
  );
}

export default DynamicMap;
