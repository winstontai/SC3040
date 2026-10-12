import { Link } from "react-router-dom";

/** Not Found Page whenever users accesses a page not specified in the router
 *
 * @author Jia Yang
 */
function NotFoundPage() {
  return(
    <div>
      <h1>404 Page Not Found</h1>
      <p>Click to 
       <Link to="/"> Return to Home</Link>
      </p>
    </div>  
  );
};

export default NotFoundPage;
