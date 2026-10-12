import { useState, useEffect } from "react";
import Hdb from "../classes/Hdb.jsx";
import TownToRegionMap from "../TownToRegion.json";

/**
 * custom hook that loads and returns
 * all the housing information
 *
 * @return {array} regions - all hdb information
 */
export function loadRegions() {
  const [regions, setRegions] = useState({
    north: [],
    central: [],
    west: [],
    east: [],
    northEast: [],
  });

  useEffect(() => {
    const fetchHdbs = async () => {
      try {
        const response = await fetch("./hdb.json");
        const data = await response.json();

        const regionsData = {
          north: [],
          central: [],
          west: [],
          east: [],
          northEast: [],
        };

        data.forEach((item, index) => {
          const hdb = new Hdb(
            item.month,
            item.town,
            item.flat_type,
            item.block,
            item.street_name,
            item.storey_range,
            item.floor_area_sqm,
            item.flat_model,
            item.lease_commence_date,
            item.remaining_lease,
            item.resale_price,
            item.address,
            item.latitude,
            item.longitude
          );
          hdb.key = `${index}`;
          const t = TownToRegionMap[hdb.town.toUpperCase()];

          switch (t) {
            case "North":
              regionsData.north.push(hdb);
              break;
            case "Central":
              regionsData.central.push(hdb);
              break;
            case "East":
              regionsData.east.push(hdb);
              break;
            case "West":
              regionsData.west.push(hdb);
              break;
            case "North-East":
              regionsData.northEast.push(hdb);
              break;
            default:
              break;
          }
        });

        setRegions(regionsData);
      } catch (error) {
        console.error("Error fetching:", error);
      }
    };
    fetchHdbs();
  }, []);

  return regions;
}

export default loadRegions; 
