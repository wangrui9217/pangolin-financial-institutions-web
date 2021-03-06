<template>
  <section class="component work-message">
    <span @click="updateMessageBoxVisible(true)">
      <el-badge :value="unReadCount" v-if="unReadCount" class="icon">
        <svg-icon iconName="message" iconSize="32"></svg-icon>
      </el-badge>
      <svg-icon v-else class="icon" iconName="message" iconSize="32"></svg-icon>
    </span>
    <el-dialog :visible.sync="messageBoxVisible" title="消息列表">
      <message-box :visible.sync="messageBoxVisible"></message-box>
    </el-dialog>
  </section>
</template>

<script lang="ts">
import Vue from "vue";
import Component from "vue-class-component";
import { State, Mutation, Action, namespace } from "vuex-class";
import MessageBox from "~/components/workspace/message/message-box.vue";
import SvgIcon from "~/components/common/svg-icon.vue";
import { Dependencies } from "~/core/decorator";
import { ReminderMessageService } from "~/services/reminder-service/reminder-message.service";
import { reminderType } from "~/config/enum.config"
const workspaceModule = namespace("workspace");

@Component({
  components: {
    MessageBox,
    SvgIcon
  }
})
export default class WorkMessage extends Vue {
  @Dependencies(ReminderMessageService) private reminderMessageService: ReminderMessageService;
  @workspaceModule.State private unReadCount;
  @workspaceModule.State("messageBoxVisible") private mMessageBoxVisible
  @workspaceModule.Mutation private updateMessageBoxVisible
  @workspaceModule.Action private updateUnReadCount;

  private get messageBoxVisible() {
    return this.mMessageBoxVisible
  }

  private set messageBoxVisible(value) {
    this.updateMessageBoxVisible(value)
  }

  private mounted() {
    // 更新未读消息
    this.updateUnReadCount();
    // 收到消息通知时更新未读消息
    this.$reminder
      .addMessageListener()
      .subscribe(data => {
        this.updateUnReadCount()
      })
  }
}
</script>

<style lang="less" scoped>
.component.work-message {
  margin-right: 20px;
  .icon {
    color: white;
    cursor: pointer;
  }
}
</style>
