import { useUser, useClerk } from '@clerk/clerk-react';
import { Content } from 'antd/es/layout/layout';
import { Outlet } from 'umi';
export default function AuthLayout() {
    const { user, isSignedIn } = useUser();
    const clerk = useClerk()
    if (!isSignedIn) {
        clerk.openSignIn()
        return <div></div>
    }
    return <Content style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Outlet /></Content> 
}