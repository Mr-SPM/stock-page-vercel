import { Input, Modal } from "antd";
import { useState } from "react";

export default  function AuthModal() {
    const [token, setToken] = useState('')
    const onOk = () => {
        if(token === TOKEN) {
            localStorage.setItem('my-token', token)
            location.reload()
        }
    }
    return <Modal title="警告" open onOk={onOk}>
        <Input placeholder="请输入授权码" onChange={e => setToken(e.target.value)} value={token} />
    </Modal>
}