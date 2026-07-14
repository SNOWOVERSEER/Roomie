/* Customers 骨架 */
export default function Loading() {
  return (
    <>
      <div className="skel" style={{ height: 30, width: 170, margin: "4px 0 12px" }} />
      <div className="skel" style={{ height: 16, width: 320, marginBottom: 18 }} />
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="skel" style={{ height: 52, marginBottom: 10, borderRadius: 14 }} />
      ))}
    </>
  );
}
