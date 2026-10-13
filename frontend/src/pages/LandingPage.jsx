import 'bootstrap/dist/css/bootstrap.min.css';
import FilterSystem from "../FilterSystem.jsx";
import Header from "../Header.jsx";

/**
  * Renders the landing page that users first see.
  *
  * It displayes a header as well as the filtering system
  *
  */
function LandingPage() {
  return (
    <>
      <Header />
      <FilterSystem /> 
    </>
  );
};

export default LandingPage;
