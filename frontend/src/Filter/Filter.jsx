import React, { useState, useEffect } from 'react'
import PropTypes from "prop-types";
import "./Filter.css";

/**
  * Render Filter Buttons using <select />
  *
  * @param {string} optionName - the name of filter option. Set when value is NULL
  * @param {array} optionList - the list of options to be passed into the filter button.
  * @param {function} onChange - onChange handler to set value in selected
  * @see `src/FilterSystem.jsx' for useContext()o of selected
  * @return the filter buttons 
  * @author: Jia Yang
  */
function Filter({optionName="", optionList=[], option, onChange}) {
  return (
    <>
      <select 
        className={`filter-button ${option ? 'filter-button-selected' : ''}`} 
        value={option} 
        onChange={()=>onChange(event.target.value)
        }> 
        <option value="" key="">{optionName}</option>
        {optionList.map((value, key)=> (<option key={key}>{value}</option>))}
      </select>
    </>
  );
};

Filter.propTypes = {
  optionName: PropTypes.string,
  optionList: PropTypes.array,
};

export default Filter;
