'use client'

import { useRef, useState } from 'react'
import {
  Button,
  ButtonGroup,
  Form,
  Layout,
  Modal,
  Notification,
  Popconfirm,
  Table,
  Tag,
  Typography,
} from '@douyinfe/semi-ui'
import { FormApi } from '@douyinfe/semi-ui/lib/es/form'
import {
  IconDeleteStroked,
  IconEdit2Stroked,
  IconPlusCircle,
  IconSetting,
} from '@douyinfe/semi-icons'
import useSWR from 'swr'
import {
  fetcher,
  LivePlatformEntity,
  put,
  requestDelete,
  sendRequest,
} from '@/app/lib/api-streamer'
import styles from './page.module.css'

const requiredMessage = '该项为必填项'

export default function PlatformsPage() {
  const { Header, Content } = Layout
  const formApi = useRef<FormApi>()
  const { data: platforms, isLoading, mutate } = useSWR<LivePlatformEntity[]>(
    '/v1/platforms',
    fetcher
  )
  const [visible, setVisible] = useState(false)
  const [editing, setEditing] = useState<LivePlatformEntity>()
  const [audioOnly, setAudioOnly] = useState(false)
  const [saving, setSaving] = useState(false)

  const openCreate = () => {
    setEditing(undefined)
    setAudioOnly(false)
    setVisible(true)
  }

  const openEdit = (platform: LivePlatformEntity) => {
    setEditing(platform)
    setAudioOnly(platform.audio_only)
    setVisible(true)
  }

  const showError = (title: string, error: unknown) => {
    Notification.error({
      title,
      content: error instanceof Error ? error.message : String(error),
    })
  }

  const savePlatform = async () => {
    const values = await formApi.current?.validate()
    const payload = {
      ...values,
      id: editing?.id,
      name: values?.name?.trim(),
      url_template: values?.url_template?.trim(),
      audio_only: Boolean(values?.audio_only),
      cover_path: values?.audio_only ? values?.cover_path?.trim() || null : null,
    }
    setSaving(true)
    try {
      if (editing) {
        await put('/v1/platforms', { arg: payload })
      } else {
        await sendRequest('/v1/platforms', { arg: payload })
      }
      await mutate()
      setVisible(false)
    } catch (error) {
      showError(editing ? '更新平台失败' : '创建平台失败', error)
      throw error
    } finally {
      setSaving(false)
    }
  }

  const deletePlatform = async (id: number) => {
    try {
      await requestDelete('/v1/platforms', { arg: id })
      await mutate()
    } catch (error) {
      showError('删除平台失败', error)
    }
  }

  const columns = [
    {
      title: '平台名称',
      dataIndex: 'name',
      width: 180,
      render: (name: string) => <Typography.Text strong>{name}</Typography.Text>,
    },
    {
      title: '直播地址模板',
      dataIndex: 'url_template',
      width: 340,
      render: (template: string) => (
        <Typography.Text code ellipsis={{ showTooltip: true }} className={styles.templateText}>
          {template}
        </Typography.Text>
      ),
    },
    {
      title: '流类型',
      dataIndex: 'audio_only',
      width: 120,
      render: (audio: boolean) =>
        audio ? <Tag color="amber">纯音频</Tag> : <Tag color="green">音视频</Tag>,
    },
    {
      title: '转换封面',
      dataIndex: 'cover_path',
      render: (coverPath?: string) => (
        <Typography.Text type={coverPath ? 'secondary' : 'tertiary'} ellipsis={{ showTooltip: true }}>
          {coverPath || '-'}
        </Typography.Text>
      ),
    },
    {
      title: '操作',
      dataIndex: 'id',
      width: 112,
      fixed: 'right' as const,
      render: (id: number, platform: LivePlatformEntity) => (
        <ButtonGroup theme="borderless">
          <Button
            aria-label="编辑平台"
            className={styles.iconButton}
            icon={<IconEdit2Stroked />}
            onClick={() => openEdit(platform)}
          />
          <Popconfirm
            title="确定删除该平台？"
            content="正在使用的平台不能删除"
            onConfirm={() => deletePlatform(id)}
          >
            <Button
              aria-label="删除平台"
              className={styles.iconButton}
              type="danger"
              icon={<IconDeleteStroked />}
            />
          </Popconfirm>
        </ButtonGroup>
      ),
    },
  ]

  return (
    <>
      <Header className={styles.header}>
        <nav className={styles.toolbar}>
          <div className={styles.titleGroup}>
            <span className={styles.titleIcon}>
              <IconSetting size="large" />
            </span>
            <h4>平台维护</h4>
          </div>
          <Button icon={<IconPlusCircle />} theme="solid" onClick={openCreate}>
            新建平台
          </Button>
        </nav>
      </Header>

      <Content className={styles.content}>
        <main className={styles.main}>
          <Table
            rowKey="id"
            size="small"
            columns={columns}
            dataSource={platforms || []}
            loading={isLoading}
            pagination={false}
            scroll={{ x: 1120 }}
          />
        </main>
      </Content>

      <Modal
        title={editing ? '编辑平台' : '新建平台'}
        visible={visible}
        confirmLoading={saving}
        onOk={savePlatform}
        onCancel={() => setVisible(false)}
        style={{ width: 'min(560px, 92vw)' }}
      >
        <Form
          key={editing?.id ?? 'new'}
          initValues={editing || { audio_only: false }}
          getFormApi={api => (formApi.current = api)}
        >
          <Form.Input
            field="name"
            label="平台名称"
            rules={[{ required: true, message: requiredMessage }]}
          />
          <Form.Input
            field="url_template"
            label="直播地址模板"
            placeholder="https://example.com/live/{room_id}"
            rules={[
              { required: true, message: requiredMessage },
              {
                validator: (_rule, value) =>
                  typeof value === 'string' &&
                  value.split('{room_id}').length === 2 &&
                  /^https?:\/\//.test(value),
                message: '模板需以 http(s) 开头并包含一个 {room_id}',
              },
            ]}
          />
          <Form.Switch
            field="audio_only"
            label="仅支持音频流"
            onChange={checked => setAudioOnly(Boolean(checked))}
          />
          {audioOnly ? (
            <Form.Input
              field="cover_path"
              label="转换封面路径"
              placeholder="C:\\media\\audio-cover.jpg"
            />
          ) : null}
        </Form>
      </Modal>
    </>
  )
}
