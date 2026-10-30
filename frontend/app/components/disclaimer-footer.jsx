import "../styles/disclaimer-footer.css";

export function DisclaimerFooter() {
  return (
    <footer className="disclaimer-footer" aria-labelledby="disclaimer-heading">
      <div className="disclaimer-panel">
        <h2 id="disclaimer-heading"><span>Disclaimer</span></h2>
        <p className="disclaimer-safety">
          Only consume what you can identify with absolute certainty. When in doubt, leave it out.
        </p>
        <p className="disclaimer-liability">
          Pine &amp; Dandy shall not be held liable for any injury, harm, or loss arising from the use of this app or the consumption of any foraged items.
        </p>
      </div>
    </footer>
  );
}
