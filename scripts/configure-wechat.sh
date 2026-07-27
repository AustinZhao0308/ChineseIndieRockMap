#!/usr/bin/env bash

set -euo pipefail
umask 077

wechat_script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
wechat_project_root="$(cd -- "${wechat_script_dir}/.." && pwd)"
wechat_env_file="${wechat_project_root}/.env"
wechat_temp_file=""

cleanup_wechat_config() {
  unset wechat_app_id wechat_app_secret wechat_existing_secret
  if [[ -n "${wechat_temp_file}" && -f "${wechat_temp_file}" ]]; then
    rm -f -- "${wechat_temp_file}"
  fi
}

trap cleanup_wechat_config EXIT

if [[ -L "${wechat_env_file}" ]]; then
  echo "拒绝写入符号链接：${wechat_env_file}" >&2
  exit 1
fi

touch "${wechat_env_file}"
chmod 600 "${wechat_env_file}"

wechat_existing_app_id="$(sed -n 's/^WECHAT_CATBEER_APP_ID=//p' "${wechat_env_file}" | tail -n 1)"
wechat_existing_secret="$(sed -n 's/^WECHAT_CATBEER_APP_SECRET=//p' "${wechat_env_file}" | tail -n 1)"

echo "配置微信公众号 API"
echo "项目目录：${wechat_project_root}"
echo

while true; do
  if [[ -n "${wechat_existing_app_id}" ]]; then
    read -r -p "请输入公众号 AppID [${wechat_existing_app_id}]：" wechat_app_id
    wechat_app_id="${wechat_app_id:-${wechat_existing_app_id}}"
  else
    read -r -p "请输入公众号 AppID：" wechat_app_id
  fi

  if [[ "${wechat_app_id}" =~ ^wx[0-9A-Za-z]{16}$ ]]; then
    break
  fi

  echo "AppID 格式不正确，应以 wx 开头，后接 16 位字符。" >&2
done

while true; do
  if [[ -n "${wechat_existing_secret}" ]]; then
    read -r -s -p "请输入公众号 AppSecret（直接回车保留现有值）：" wechat_app_secret
    echo
    wechat_app_secret="${wechat_app_secret:-${wechat_existing_secret}}"
  else
    read -r -s -p "请输入公众号 AppSecret：" wechat_app_secret
    echo
  fi

  if [[ "${wechat_app_secret}" =~ ^[0-9A-Za-z]{32}$ ]]; then
    break
  fi

  echo "AppSecret 格式不正确，应为 32 位字符。" >&2
done

wechat_temp_file="$(mktemp "${wechat_env_file}.tmp.XXXXXX")"

awk '
  !/^WECHAT_CATBEER_APP_ID=/ &&
  !/^WECHAT_CATBEER_APP_SECRET=/
' "${wechat_env_file}" > "${wechat_temp_file}"

if [[ -s "${wechat_temp_file}" ]]; then
  printf '\n' >> "${wechat_temp_file}"
fi

printf 'WECHAT_CATBEER_APP_ID=%s\n' "${wechat_app_id}" >> "${wechat_temp_file}"
printf 'WECHAT_CATBEER_APP_SECRET=%s\n' "${wechat_app_secret}" >> "${wechat_temp_file}"

chmod 600 "${wechat_temp_file}"
mv -- "${wechat_temp_file}" "${wechat_env_file}"
wechat_temp_file=""

echo
echo "配置完成："
echo "  AppID：${wechat_app_id}"
echo "  AppSecret：已安全写入（未显示）"
echo "  文件：${wechat_env_file}"
echo
echo "请确认微信开发者平台的 API IP 白名单包含服务器公网 IP。"
