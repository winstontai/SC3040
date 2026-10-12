import 'bootstrap/dist/css/bootstrap.min.css';
import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';

/** 
 * Boostraps header component with navigation 
 **/

function Header() {
  return (
    <>
      <Navbar bg="dark" data-bs-theme="dark" fixed="top">
        <Container>
          <Navbar.Brand href="/">HDBuddy</Navbar.Brand>
          <Nav className="me-auto">
            <Nav.Link href="/tutorial">Tutorial</Nav.Link>
            <Nav.Link href="/map">Map</Nav.Link>
            <Nav.Link href="/overview">Overview</Nav.Link>
          </Nav>
        </Container>
      </Navbar>
    </>
  );
}

export default Header;
