import React from "react";

const Bar = ({ value }) => {
  // Ensure value is clamped between 0 and 1
  //   console.log(value);
  const safeValue = Math.max(0, Math.min(1, value));
  const percentage = safeValue * 100;

  const getColorForPercentage = (percentage) => {
    if (percentage >= 90) return "#006400"; // dark green
    if (percentage >= 80) return "#228B22"; // forest green
    if (percentage >= 70) return "#32CD32"; // lime green
    if (percentage >= 60) return "#66BB6A"; // medium green
    if (percentage >= 50) return "#FFD700"; // gold
    if (percentage >= 40) return "#FFA500"; // orange
    if (percentage >= 30) return "#FF8C00"; // dark orange
    if (percentage >= 20) return "#FF6347"; // tomato
    if (percentage >= 10) return "#FF4500"; // orange red
    return "#F44336"; // red
  };

  const fillColor = getColorForPercentage(percentage);
  //   const fillColor =
  //     percentage > 50 ? "green" : percentage > 20 ? "orange" : "red";

  return (
    <div style={styles.container}>
      <div
        style={{
          ...styles.fill,
          width: `${percentage}%`,
          backgroundColor: fillColor,
        }}
      />
    </div>
  );
};

const styles = {
  container: {
    width: "200px",
    height: "20px",
    backgroundColor: "#ddd",
    borderRadius: "6px",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    transition: "width 0.3s ease",
  },
};

export default Bar;
