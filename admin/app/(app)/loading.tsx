/* Dashboard 骨架：切页瞬时反馈（数据在途时占住版面） */
export default function Loading() {
  return (
    <>
      <div className="skel" style={{ height: 30, width: 190, margin: "4px 0 18px" }} />
      <div className="kpis">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skel" style={{ height: 78 }} />
        ))}
      </div>
      <div className="skel" style={{ height: 178, marginTop: 24 }} />
      <div className="skelRow" style={{ marginTop: 26 }}>
        <div className="skel" style={{ height: 230, flex: "1 1 300px" }} />
        <div className="skel" style={{ height: 230, flex: "1 1 300px" }} />
      </div>
    </>
  );
}
