/* Waitlist 骨架 */
export default function Loading() {
  return (
    <>
      <div className="skel" style={{ height: 30, width: 140, margin: "4px 0 12px" }} />
      <div className="skel" style={{ height: 16, width: 260, marginBottom: 18 }} />
      <div className="skel" style={{ height: 240, borderRadius: 12 }} />
    </>
  );
}
