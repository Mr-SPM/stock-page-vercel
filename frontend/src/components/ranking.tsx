import React from "react";
import { Card, List, Tag } from "antd";
import { TrophyOutlined } from "@ant-design/icons";

export default function Top5Ranking({ data }) {
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  const getColor = (value) => {
    if (value > 0.08) return "volcano";
    if (value > 0.05) return "orange";
    if (value > 0) return "red";
    return "green";
  };

  return (
    <Card
      title={
        <>
          <TrophyOutlined style={{ color: "#faad14" }} /> 本月累计涨幅 TOP 5
        </>
      }
      bordered={false}
      style={{ marginBottom: 24 }}
    >
      <List
        dataSource={data}
        renderItem={(item, index) => (
          <List.Item>
            <div style={{ width: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>
                  <strong>
                    #{index + 1} {item.symbol}
                  </strong>
                  <div style={{ fontSize: 12, color: "#888" }}>
                    {item.name}
                  </div>
                </div>

                <Tag color={getColor(item.cumulative_return)}>
                  {(item.cumulative_return * 100).toFixed(2)}%
                </Tag>
              </div>
            </div>
          </List.Item>
        )}
      />
    </Card>
  );
}
