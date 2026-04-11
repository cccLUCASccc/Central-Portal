<script lang="ts">
  import type { Item } from '../../type'
  let { vehicules } : { vehicules : Item[]} = $props()
</script>


<div class="overflow-x-auto">
  <table class="table">
    <thead>
      <tr>
        <th>
          <label>
            <input type="checkbox" class="checkbox" />
          </label>
        </th>
        <th>Name</th>
        <th>Decription</th>
        <th>Price</th>
        <th>Sold</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
       {#each vehicules as vehicule}
        <tr>
          <th>
            <label>
              <input type="checkbox" class="checkbox" />
            </label>
          </th>
          <td>
            <div class="flex items-center gap-3">
              <div class="avatar">
                <div class="mask mask-squircle h-12 w-12">
                  <img
                    src={vehicule.images[0]?.url}
                    alt="Avatar Tailwind CSS Component" />
                </div>
              </div>
              <div>
                <div class="font-bold">{vehicule.name}</div>
              </div>
            </div>
          </td>
          <td>
            {vehicule.description}
            <br />
          </td>
          <td>{vehicule?.price}</td>
          <td>{vehicule?.sold}</td>
          <th>
            <a class="btn btn-primary btn-xs" href={`/vehicules/${vehicule.id}`}>Details</a>
          </th>
        </tr>
      {/each}
    </tbody>
  </table>
</div>