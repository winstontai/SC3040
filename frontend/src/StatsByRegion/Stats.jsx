import { useState, useEffect } from "react";
import Chart from 'react-apexcharts'; 
import { loadRegions } from './loadRegions.js';
import "./Stats.css";

function Stats() {
  const regions = loadRegions(); // this is a custom 'hook'

  const avg = (flatArray) => {
    if (!flatArray || flatArray.length === 0) return 0;
    let sum = 0;
    flatArray.forEach((item) => {
      sum += parseFloat(item.resale_price);  
    });
    return (sum / flatArray.length).toFixed(2);
  };


  /** Facade design pattern to encapsulate the calculation of price statistics
   * (quartiles and inner fences) for a specific room type within a region.
   * This function calculates the lower (lo), first quartile (q1), median (q2),
   * third quartile (q3), and upper (hi) fences based on the resale prices of
   * flats in a given region and room type.
   *
   * @param {array} region - An array of flat objects containing details like
   * `flat_type` and `resale_price`. 
   * @param {string} room - The room type (e.g., "3-room", "4-room", etc.) 
   * for which price statistics are to be calculated.
   * 
   * @returns {Object} An object containing the following price statistics: 
   *    - {number} lo - The lower inner fence (1.5 * IQR below the first quartile). 
   *    - {number} q1 - The first quartile (25th percentile). 
   *    - {number} q2 - Themedian (50th percentile). 
   *    - {number} q3 - The third quartile (75thpercentile). 
   *    - {number} hi - The upper inner fence (1.5 * IQR above the third quartile).
   */  
  const getPriceStats = (region, room) => {
    const array = [];
    region.forEach((item) => {
      if (item.flat_type === room) {
        array.push(item.resale_price)
      }
    });

    array.sort((a,b) => a - b);

    const getMedian = (array) => {
      const mi = Math.floor(array.length/2);
      return (array.length % 2 == 0)? (array[mi-1]+array[mi])/2 : array[mi];
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


    const lo = array.find(x => x >= q1 - 1.5 * IQR) || array[0];
    const hi = array.slice().reverse().find(x => x <= q3 + 1.5 * IQR) || array[array.length - 1];

    return {lo, q1, q2, q3, hi};
  };


 /**
 * Calculates the distribution of flat types within a given region.
 * This function counts the number of flats of each type (2 ROOM, 3 ROOM, etc.)
 * within the provided region data and returns the count for each flat type.
 *
 * @param {array} region - An array of flat objects containing a `flat_type` property.
 * 
 * @returns {Object} An object containing the count of flats for each flat type:
 *   - '2 ROOM': The count of 2-room flats.
 *   - '3 ROOM': The count of 3-room flats.
 *   - '4 ROOM': The count of 4-room flats.
 *   - '5 ROOM': The count of 5-room flats.
 *   - 'EXECUTIVE': The count of executive flats.
 * 
 * @example
 * getFlatDistributionStats(region);
 * Returns: { '2 ROOM': 5, '3 ROOM': 10, '4 ROOM': 7, '5 ROOM': 3, 'EXECUTIVE': 2 }
 *
 * @author: jiayang
 */ 
  const getFlatDistributionStats = (region) => {

    const dataContainer = {
      '2 ROOM': 0,
      '3 ROOM': 0,
      '4 ROOM': 0,
      '5 ROOM': 0,
      'EXECUTIVE': 0
    }

    region.forEach((item) => {
      if (dataContainer.hasOwnProperty(item.flat_type))
        dataContainer[item.flat_type]++;
    });


    return dataContainer;
  }


  const drawFlatDistributionGraph = (regionstring) => {

    const stats = getFlatDistributionStats(regions[regionstring]);
    const categories = Object.keys(stats);
    const data = Object.values(stats); 
    const options = {
      colors: ["#2F3C7E"],
      plotOptions: {
        bar: {
          borderRadius: 8,
          dataLabels: { position: "top" },
        }
      },
      dataLabels: {
        enabled: true,
        formatter: (val) => val,
        offsetY: 0,
        style: { fontSize: "24px", colors: ["#FBEAEB"] }
      },
      xaxis: { categories: categories, axisBorder: { show: false }, axisTicks: { show: false } },
      yaxis: { labels: { show: true } },
      title: { 
        text: `Flat Type Distribution for ${regionstring}`, 
        align: "center",
        style: {
          fontSize: '32px',
          color: '#2F3C7E'
        },
      },
    };

    return {options: options, data: data}; 
  }


  const drawPriceDistributionGraph = (room) => {

    const dataContainer = {
      'north': null,
      'central': null,
      'west': null,
      'east': null,
      'northEast': null
    }


    Object.keys(dataContainer).forEach(region => {
      dataContainer[region] = getPriceStats(regions[region], room);
    });

    const boxPlotData = Object.keys(dataContainer).map(region => {
      const stats = dataContainer[region];
      return {
        x: region,
        y: [stats.lo, stats.q1, stats.q2, stats.q3, stats.hi]
      };
    });

    const options = {
      plotOptions: {
        boxPlot: {
          borderRadius: 8,
          colors: {
            upper: '#2F3C7E',
            lower: '#FBEAEB'
          },
        },
      },
      title: {
        text: `Price Distribution for ${room} Flats`,
        align: 'center',
        style: {
          fontSize: '32px',
          color: '#2F3C7E'
        },
      },

      xaxis: {
        categories: Object.keys(dataContainer) 
      },
    };

    return {options: options, data: boxPlotData}
  };


  const [room, setRoom] = useState("2 ROOM"); 
  const [optPrice, setOptPrice] = useState({});
  const [dataPrice, setDataPrice] = useState([]); 

  useEffect(() => {
    const { options, data } = drawPriceDistributionGraph(room);
    setOptPrice(options);
    setDataPrice(data);
  }, [room, regions]);

  const handleRoomChange = (room, id) => {
    setActiveb(id);
    setRoom(room);
  };

  const [r, setR] = useState("north");
  const handleRegionChange = (region, id) => {
    setActiveb(id);
    setR(region);
  };
  const [optCount, setOptCount] = useState({});
  const [dataCount, setDataCount] = useState([]); 



  useEffect(() => {
    const { options, data } = drawFlatDistributionGraph(r);
    setOptCount(options);
    setDataCount(data);
  }, [r, regions]);

  const [activeb, setActiveb] = useState(null);

  const roomb = [
    {id: 1, label: "2 ROOM"},
    {id: 2, label: "3 ROOM"},
    {id: 3, label: "4 ROOM"},
    {id: 4, label: "5 ROOM"},
    {id: 5, label: "EXECUTIVE"}
  ];

  const flatb = [
    {id: 6, label: "north"},
    {id: 7, label: "central"},
    {id: 8, label: "east"},
    {id: 9, label: "west"},
    {id: 10, label: "northEast"}
  ];

  return (
    <>

      <div className="chart-container">
        <h2 className="heading">Price Distribution of Flats By Region</h2> 
        <div className="boxplot">
          <Chart
            options={optPrice}
            series={[{data: dataPrice}]}
            type="boxPlot"
            height={450}
          />
        </div>
        <div className="button-container">
          {roomb.map((room) => (
            <button
              key={room.id}
              onClick={() => handleRoomChange(room.label, room.id)}
              className={activeb === room.id ? "clicked" : "button"}
            >
              {room.label.toLowerCase()}
            </button>
          ))}
        </div>
      </div>


      <div className="chart-container">

        <h2 className="heading">Flat Type Distribution By Region</h2> 

        <div className="histogram">
          <Chart
            options={optCount}
            series={[{name: 'Flat Count', data: dataCount}]}
            type="bar"
            height={450}
          />
        </div>

        <div className="button-container">
          {flatb.map((r) => (
            <button
              key={r.id}
              onClick={() => handleRegionChange(r.label, r.id)}
              className={activeb === r.id ? "clicked" : "button"}
            >
              {r.label.toLowerCase()}
            </button>
          ))}
        </div>

      </div>

    </>
  );
} export default Stats;
