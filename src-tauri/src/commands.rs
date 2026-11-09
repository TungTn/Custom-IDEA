use ide_vfs as vfs;
use ide_index as index;
use ide_docker as docker;
use ide_coverage as coverage;
use ide_run as process;
use ide_terminal as pty;
use ide_vcs as git;
use ide_lsp as lsp;
use ide_dap as dap;
use ide_db as db;
use ide_http as http;
use crate::window;

/// Registers and generates the Tauri IPC command handler for all domain modules.
pub fn get_ipc_handler() -> impl Fn(tauri::ipc::Invoke<tauri::Wry>) -> bool + Send + Sync + 'static {
  tauri::generate_handler![
    // ─── 1. VFS / File System Commands ───
    vfs::select_directory, 
    vfs::create_project_on_disk, 
    vfs::open_project_dialog, 
    vfs::open_project_by_path,
    vfs::read_file_content,
    vfs::save_file_content,
    vfs::vfs_read_file,
    vfs::vfs_write_file,
    vfs::write_file_content,
    vfs::file_exists,
    vfs::vfs_get_line_count,
    vfs::search_project_files,
    vfs::search_project_text,
    vfs::watch_project_directory,
    vfs::pick_settings_file,
    vfs::pick_settings_folder,
    vfs::pick_settings_export_path,
    vfs::read_settings_from_zip_or_folder,
    vfs::export_settings_to_zip,
    vfs::vfs_copy_file,
    vfs::vfs_move_path,
    vfs::vfs_delete_path,
    vfs::vfs_create_dir,

    // ─── 2. Project Indexer Commands (ide-index) ───
    index::index_project,
    index::search_project_index,

    // ─── 3. Docker Commands (ide-docker) ───
    docker::docker_get_daemon_status,
    docker::docker_list_containers,
    docker::docker_list_images,
    docker::docker_start_container,
    docker::docker_stop_container,
    docker::docker_restart_container,
    docker::docker_remove_container,
    docker::docker_get_logs,
    docker::docker_set_config,
    docker::docker_test_cli,

    // ─── 4. Code Coverage Commands (ide-coverage) ───
    coverage::coverage_load_file,
    coverage::coverage_get_for_file,
    coverage::coverage_get_summary,
    coverage::coverage_detect_reports,

    // ─── 5. Window & Desktop App Commands ───
    window::open_in_new_window,
    window::get_window_initial_project,
    window::app_minimize_window,
    window::app_toggle_maximize_window,
    window::app_close_window,
    window::app_is_maximized,
    window::app_start_dragging,
    window::fetch_marketplace_plugins,
    window::fetch_plugin_details,
    window::reveal_in_explorer,

    // ─── 6. Toolchains & Process Commands (ide-run) ───
    process::detect_toolchains,
    process::detect_installed_jdks,
    process::validate_and_parse_jdk,
    process::create_downloaded_jdk_placeholder,
    process::execute_build_command,
    process::start_process,
    process::stop_process,
    process::stop_all_processes,

    // ─── 7. PTY Terminal Commands (ide-terminal) ───
    pty::terminal_spawn,
    pty::terminal_write,
    pty::terminal_resize,
    pty::terminal_kill,
    pty::get_available_shells,

    // ─── 8. Git / VCS Commands (ide-vcs) ───
    git::test_git_executable,
    git::set_git_executable_path,
    git::git_get_status,
    git::git_get_blame,
    git::git_get_diff,
    git::git_add,
    git::git_commit,
    git::git_push,
    git::git_get_log,
    git::git_get_commit_details,
    git::git_get_file_content_at_head,
    git::git_get_file_content_at_revision,
    git::git_rollback_file,
    git::git_fetch,
    git::git_pull,
    git::git_list_branches,
    git::git_get_tags,
    git::git_checkout_branch,
    git::git_clone,
    git::git_get_stash_list,
    git::git_stash_save,
    git::git_stash_pop,
    git::git_stash_apply,
    git::git_stash_drop,
    git::git_stash_clear,
    git::git_stash_get_files,
    git::git_reset_branch,
    git::git_cherry_pick,
    git::git_revert_commit,
    git::git_create_tag,
    git::git_create_branch_from,
    git::git_delete_branch,
    git::git_rename_branch,
    git::git_merge_branch,
    git::git_rebase_branch,
    git::git_create_patch,
    git::git_get_conflicts,
    git::git_get_conflict_stages,
    git::git_resolve_conflict,

    // ─── 9. LSP Language Server Commands (ide-lsp) ───
    lsp::lsp_start_server,
    lsp::lsp_set_server_path,
    lsp::lsp_send_request,
    lsp::lsp_send_notification,
    lsp::lsp_stop_server,
    lsp::lsp_get_active_servers,

    // ─── 10. DAP Debugger Commands (ide-dap) ───
    dap::dap_start_session,
    dap::dap_set_breakpoints,
    dap::dap_continue,
    dap::dap_step_over,
    dap::dap_step_into,
    dap::dap_step_out,
    dap::dap_pause,
    dap::dap_stop,
    dap::dap_get_stack_trace,
    dap::dap_get_scopes,
    dap::dap_get_variables,
    dap::dap_evaluate,

    // ─── 11. Database Commands (ide-db) ───
    db::db_test_connection,
    db::db_introspect_schema,
    db::db_execute_query,
    db::db_get_table_data,

    // ─── 12. HTTP REST Client Commands (ide-http) ───
    http::http_execute_request,
    http::http_parse_file,
    http::http_execute_file_block,

    // ─── 13. Auto-Updater Commands (MIC Studio Standard) ───
    crate::updater::apply_update_and_restart,
    crate::updater::get_app_version_info
  ]
}
