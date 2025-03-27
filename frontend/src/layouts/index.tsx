import AuthModal from '@/components/auth';
import { Layout, Input } from 'antd';
import { Outlet } from 'umi';

const { Content, Footer } = Layout
export default function MyLayout() {
  const token = localStorage.getItem('my-token')
  
  return <Layout style={{ width: '100%', height: '100%', padding: 16 }}>
    <Content style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{token === TOKEN ? <Outlet /> : <AuthModal />}</Content>
    <Footer>
      <div style={{ textAlign: 'right' }}>
        数据来源：<a href='https://finance.sina.com.cn/'>新浪财经</a>
      </div>
    </Footer>
  </Layout>

}
