import AuthModal from '@/components/auth';
import { ClerkProvider } from '@clerk/clerk-react';
import { Layout } from 'antd';
import AuthLayout from './authLayout';
import { zhCN } from '@clerk/localizations'


const { Content } = Layout
export default function MyLayout() {
  const token = localStorage.getItem('my-token')

  return <ClerkProvider publishableKey={NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY} localization={zhCN}   ><Layout style={{ width: '100%', height: '100%', padding: 16 }}>
    <Content style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{token === TOKEN ? <AuthLayout /> : <AuthModal />}</Content>
  </Layout>
  </ClerkProvider>

}
