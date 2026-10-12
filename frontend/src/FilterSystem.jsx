
import { useState, useMemo, useEffect, useContext } from 'react';
import Filter from "./Filter/Filter.jsx";
import { useNavigate } from "react-router-dom";
import Hdb from "./classes/Hdb.jsx";
import TownToRegionMap from "./TownToRegion.json";
import DynamicMap from "./DynamicMap.jsx";
import HDBContext from "./HDBContext.jsx";
import RegionalMap from './RegionalMap.jsx';
import "./FilterSystem.css";


/**
 * Function that handles filtering logic, dynamically updates number of flats available
 * @return Filter Buttons, Find Button, Count of HDB Flats
 * @author: Jia Yang
 *
 */
function FilterSystem() {
  const { filteredHdbs, setFilteredHdbs } = useContext(HDBContext);
  const [allHdbs, setAllHdbs] = useState([]);

  /**
   * Load all HDB objects into array allHdbs, filteredHdbs.
   * @construct a hdb object using its constructor
   * @pre hdb.json must have valid data
   * @throws error if pre-condition is not satisified
   */
  useEffect(() => {
    const fetchHdbs = async () => {
      try {
        const response = await fetch("./hdb.json");
        const data = await response.json();
        const hdbs = data.map((item, index) => {
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
          return hdb;
        });
        setAllHdbs(hdbs);
        setFilteredHdbs(hdbs);
      } catch (error) {
        console.error("Error fetching:", error);
      }
    };
    fetchHdbs();
  }, []);

  const navigate = useNavigate();
  const handleSearch = () => {
    navigate("map");
  };

  /**
   * Specify the list of options for filter option Region
   */
  const regionList = ["Central", "East", "North", "North-East", "West"];

  /**
   * Specify the list of options for filter option Flat Type
   */
  const roomTypeList = ["2 Room", "3 Room", "4 Room", "5 Room", "Executive"];

  /**
   * Specify the list of option for filter option Price Range
   */
  const priceRangeList = [
    "199,999 and below",
    "200,000 - 299,999",
    "300,000 - 399,999",
    "400,000 - 499,999",
    "500,000 - 599,999",
    "600,000 - 699,999",
    "700,000 - 799,999",
    "800,000 - 899,999",
    "900,000 - 999,999",
    "1,000,000 and above",
  ];

  /**
   * Specify the list of option for filter option Lease Life
   */
  const leaseLifeList = [
    "40 - 49",
    "50 - 59",
    "60 - 69",
    "70 - 79",
    "80 - 89",
    "90 - 99",
  ];

  /**
   * Intialise selected array to have key value pair of (options, NULL).
   * When the options' values are NULL, the <select /> is set to display the option name.
   * @see './Filter/Filter.jsx'
   */
  const [selected, setSelected] = useState({
    region: "",
    priceRange: "",
    roomType: "",
    leaseLife: "",
  });

  /**
   * handles changes on select of filter option, update selected option.
   *
   * @param {string} filter - key of selected array
   * @param {string} option - value of selected arary
   */
  const handleSelectChange = (filter, option) => {
    setSelected((s) => ({
      ...s,
      [filter]: option,
    }));
  };

  /**
   * Checks if all options are selected by checking if any value is NULL
   * @return {bool} whether all options is selected
   */
  const isAllSelected = !Object.values(selected).includes("");

  /**
   * Filters the HDB flats based on the options passed, updates the filteredHdbs array.
   *
   * @pre allHdbs array is initialised
   * @post updated filteredHdbs array
   * @see `classes/Hdb.jsx`
   * @author Jia Yang
   */
  useEffect(() => {
    let filtered = allHdbs;

    /**
     * Filters HDB flats to the corresponding regioins.
     *
     * There is no attribute region in HDB object since the '.csv' file fetched
     * from gov.data.sg does not contain such information. However, HDB objects
     * contain attribute town. We used a '.json' file to store the
     * corresponding key value pair (town, region) and index it O(1).
     *
     * @see 'TownToRegion.json' for the data file declared
     * @return {bool} if the region of HDB is equals to the selected region
     */
    if (selected.region) {
      filtered = filtered.filter((hdb) => {
        const region = TownToRegionMap[hdb.town.toUpperCase()] || "";
        return region === selected.region;
      });
    }


    /**
    * Filters HDB flats to the corresponding Flat Types.
    *
    * Calls the getFlatType() method in HDB objects and do a comparison.
    *
    * @return {bool} if the flat type of the HDB is equals to the selected flat
    * type
    */
    if (selected.roomType) {
      filtered = filtered.filter((hdb) => {
        const roomType = hdb.getFlatType();
        return roomType === selected.roomType.toUpperCase();
      });
    }

    /**
     * Filters the HDB flats to the corresponding remaining lease life range.
     *
     * LeaseLife are passed as "xx - xx", where x dentoes a valid integer.
     * Therefore a simple string processing is done to get the lower and upper
     * bound.
     *
     * @return {bool} if the range of the lease life of the flats is within the
     * selected bound.
     */
    if (selected.leaseLife) {
      let lowerbound = Number(selected.leaseLife.split(" ")[0]);
      let upperbound = Number(selected.leaseLife.split(" ")[2]);
      filtered = filtered.filter((hdb) => {
        const leaseLife = Number(hdb.getLeaseLife().split(" ")[0]);
        return leaseLife >= lowerbound && leaseLife <= upperbound;
      });
    }

    /**
     * Filters the HDB Flats to the corresponding resale price range.
     *
     * Price Range could be of the following format:
     * 1) int and below
     * 2) int and above
     * 3) int - int
     *
     * Therefore, the string processing technique is adjusted accordingly.
     *
     * @return {bool} if the price range of the HDB flat is within the lower and
     * upper bound
     */
    if (selected.priceRange) {
      let lowerbound = Number(
        selected.priceRange.split(" ")[0].replace(/,/g, "")
      );
      let upperbound = selected.priceRange.split(" ")[2];
      if (upperbound === "below") {
        filtered = filtered.filter((hdb) => {
          return Number(hdb.getPrice()) <= lowerbound;
        });
      } else if (upperbound === "above") {
        filtered = filtered.filter((hdb) => {
          return Number(hdb.getPrice()) >= lowerbound;
        });
      } else {
        upperbound = Number(upperbound.replace(/,/g, ""));
        filtered = filtered.filter((hdb) => {
          const price = Number(hdb.getPrice());
          return price >= lowerbound && price <= upperbound;
        });
      }
    }
    setFilteredHdbs(filtered);
  }, [selected, allHdbs]);

  const regionToIdMap = {
    "Central": "SG-01",
    "East": "SG-04",
    "North": "SG-02",
    "North-East": "SG-03",
    "West": "SG-05",
  };
  const selectedRegionId = regionToIdMap[selected.region] || "";
  return (
    <>
      <div className="wrapper">
      <div className="filter-bar-box">
        <Filter
          optionName="Region"
          optionList={regionList}
          option={selected.region}
          onChange={(value) => handleSelectChange("region", value)}
        />

        <Filter
          optionName="Price Range (S$)"
          optionList={priceRangeList}
          option={selected.priceRange}
          onChange={(value) => handleSelectChange("priceRange", value)}
        />

        <Filter
          optionName="Flat Type"
          optionList={roomTypeList}
          option={selected.roomType}
          onChange={(value) => handleSelectChange("roomType", value)}
        />

        <Filter
          optionName="Lease Life (Yr)"
          optionList={leaseLifeList}
          option={selected.leaseLife}
          onChange={(value) => handleSelectChange("leaseLife", value)}
        />
      </div>


      <div className='map-container'>
        <RegionalMap selectedRegion={selectedRegionId} />
        <div className='flats-available-overlay'>
          <h1>{filteredHdbs.length.toLocaleString()}</h1>
          <p>Flats Available</p>
        </div>
      </div>

      <div className="search-button-box">
        <button
          className={`button ${isAllSelected ? "active" : "disabled"}`}
          onClick={handleSearch}
          disabled={!isAllSelected}
        >
          Find
        </button>
      </div>
      </div>
    </>
  );
}

export default FilterSystem;
