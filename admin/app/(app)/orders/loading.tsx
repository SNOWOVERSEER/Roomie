/* Orders 骨架：标题 + 工具条 + 订单卡剪影 */
export default function Loading() {
  return (
    <>
      <div className="skel" style={{ height: 30, width: 130, margin: "4px 0 18px" }} />
      <div className="skelRow">
        <div className="skel" style={{ height: 36, width: 290 }} />
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="skel" style={{ height: 32, width: 96, borderRadius: 999 }} />
        ))}
      </div>
      <div className="skel" style={{ height: 22, width: 110, margin: "26px 0 12px" }} />
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="skel" style={{ height: 52, marginBottom: 10, borderRadius: 14 }} />
      ))}
    </>
  );
}
