import React, { useState } from 'react';
import './TutorialPage.css';
import Header from '../Header';
import { useNavigate } from 'react-router-dom';
import SelectRegion from '../assets/SelectRegion.gif';
import FilterPref from '../assets/FilterPref.gif';
import PriceDistribution from '../assets/PriceDistribution.gif';
import Boxplot from '../assets/Boxplot.gif';
import FilterOptions from '../assets/FilterOptions.gif';
import SecondaryFilters from '../assets/SecondaryFilters.gif';
import NavigatingRecommendation from '../assets/NavigatingRecommendation.gif';
import Information from '../assets/Information.gif';

const TutorialPage = () => {
  const navigate = useNavigate();
  const [expandedIndex, setExpandedIndex] = useState(null);

  const tutorialSections = [
    {
      title: "Main Page",
      steps: [
        {
          title: "Select Your Region",
          description: "Choose from Central, North East, North West, South East, or South West Singapore",
          gif: SelectRegion
        },
        {
          title: "Filter Your Preferences",
          description: "Set your price range, flat type, and lease duration and click 'Find' to see your HDB options",
          gif: FilterPref
        }
      ]
    },
    {
      title: "Map Page",
      steps: [
        {
          title: "Toggle Filters",
          description: "Click on flat that you are interested in. Toggle to turn on/off filters such as Dengue, traffic cameras,MRT and Schools",
          gif: FilterOptions
        },
        {
          title: "Adjusting recommendations to suit your prefences ",
          description: "Adjust the priority level by moving the slider left or right—values closer to 1 indicate higher priority, while values closer to 0 indicate lower priority. You can then select the flat that best matches your preferences based on the adjusted priorities. ",
          gif: NavigatingRecommendation
        },
        {
          title: "Viewing information",
          description: "Interact with the information on the left sidebar to see more details.",
          gif: Information
        }
      ]
    },
    {
      title: "Overview Page",
      steps: [
        {
          title: "Understanding Overview page",
          description: "Select between different room types and view their price distribution across various regions.",
          gif: PriceDistribution
        },
        {
          title: "Understanding the BoxPlot",
          description: "boxplot summarizes flat prices based on region and flat type. The minimum represents the cheapest flat, Q1 indicates that 25% of flats are priced below this value, the median represents the midpoint price, Q3 shows that 75% of flats are priced below this value, and the maximum represents the most expensive flat.",
          gif: Boxplot
        },
      ]
    }
  ];

  const toggleExpand = (index) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <>
      <Header />
      <div className="tutorial-container">
        <header className="tutorial-header">
          <h1>How It Works</h1>
          <p>Find your perfect HDB flat in just a few simple steps</p>
        </header>

        <div className="tutorial-steps">
          {tutorialSections.map((section, sectionIndex) => (
            <div key={sectionIndex} className="tutorial-section">
              <div className="section-separator">
                <hr />
                <h2>{section.title}</h2>
              </div>

              {section.steps.map((step, stepIndex) => {
                const globalIndex = sectionIndex * 10 + stepIndex; // ensures unique key
                return (
                  <div
                    key={globalIndex}
                    className={`step-card ${expandedIndex === globalIndex ? 'expanded' : ''}`}
                    onClick={() => toggleExpand(globalIndex)}
                  >
                    <div className="step-number">{stepIndex + 1}</div>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                    {expandedIndex === globalIndex && step.gif && (
                      <img src={step.gif} alt="Step GIF" className="step-gif-expanded" />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="tutorial-actions">
          <button 
            className="primary-button"
            onClick={() => navigate('/')}
          >
            Get Started
          </button>
        </div>
      </div>
    </>
  );
};

export default TutorialPage;
