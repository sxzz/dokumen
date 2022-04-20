<script lang="ts">
import { defineComponent } from 'vue'
import type { Interface } from './_utils/types'
import type { PropType } from 'vue'

const TRUE = true
const NUMBER = 123
const STRING = '123'

const fooPropType = String

const fooProp = {
  type: fooPropType,
  required: TRUE,
}

type CustomType = { a: string } & { b: number }

const COMP_PREFIX = 'El'
const COMP = `${COMP_PREFIX}Hello` as const

const comp = defineComponent({
  name: COMP,
  props: {
    /** @description foo 描述 */
    foo: fooProp,
    bar: {
      type: Number,
      default: NUMBER,
    },
    /**
     * @description 测试 baz
     *
     * @author 不显示
     *
     * @description 测试123
     */
    baz: {
      type: String,
      default: STRING,
    },
    custom: {
      type: Function as PropType<() => boolean | CustomType>,
      required: true,
    },
    date: {
      type: Date,
    },
    mixed: {
      type: Object as PropType<Interface>,
    },
  },
  emits: {
    /**
     * @description onclick
     * @param evt 事件
     * @param name 名称
     */
    click: (evt: MouseEvent, name: string) => !!evt,
    // select() {
    //   return true
    // },
    /**
     * @description 123
     */
    remove: undefined as any as
      | ((
          /** @param name 姓名 */
          name: string
        ) => boolean)
      | ((key: number) => boolean),
  },
  setup(props, { emit, expose }) {
    expose({
      exposeFoo: '123',
      exposeBar: 123 as const,
    } as const)
  },
})

export default comp
</script>
